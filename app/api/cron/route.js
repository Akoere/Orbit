import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendNotification } from '@/lib/email';
import { sendWhatsAppNotification } from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  try {
    // 1. SAFETY CHECK: THE SKIPPER
    // RapidAPI Free Limit = 500 reqs/month.
    // Hourly runs = 720 reqs/month.
    // We must randomly skip ~30% of runs to stay free (Target: ~480 reqs).
    // If you pay for a plan, remove this block.
    if (Math.random() < 0.35) {
        return NextResponse.json({ success: true, message: "Skipped to save API credits (Free Tier Mode)" });
    }

    // 2. FETCH WATCHLIST
    const { data: watchlist, error } = await supabaseAdmin.from('watchlist').select('*');
    if (error) throw error;

    const results = [];
    const updates = {}; 

    // =========================================================
    // STEP A: TWITTER/X via RapidAPI (Single User Rotation)
    // =========================================================
    const twitterItems = watchlist.filter(i => i.platform === 'X' || i.platform === 'Twitter');

    // We check ONLY 1 random user per run to save credits.
    const luckyWinner = twitterItems[Math.floor(Math.random() * twitterItems.length)];

    if (luckyWinner && process.env.RAPIDAPI_KEY) {
        const cleanHandle = luckyWinner.handle.replace(/[@\s]/g, '').trim();
        console.log(`[RapidAPI] Checking 1 lucky winner: @${cleanHandle}`);

        try {
            // Step 1: Get user ID from username (API requires numeric ID)
            const userLookupUrl = `https://twitter241.p.rapidapi.com/user?username=${cleanHandle}`;
            
            const userRes = await fetch(userLookupUrl, {
                method: 'GET',
                headers: {
                    'x-rapidapi-key': process.env.RAPIDAPI_KEY,
                    'x-rapidapi-host': 'twitter241.p.rapidapi.com'
                }
            });

            if (!userRes.ok) {
                console.error(`[RapidAPI] User lookup failed: ${userRes.status}`);
                return;
            }

            const userData = await userRes.json();
            const userId = userData.result?.data?.user?.result?.rest_id || 
                          userData.result?.rest_id || 
                          userData.data?.user?.id ||
                          userData.id;
            
            if (!userId) {
                console.error(`[RapidAPI] Could not find user ID for @${cleanHandle}`);
                console.log(`[RapidAPI] User response:`, JSON.stringify(userData).substring(0, 300));
                return;
            }

            console.log(`[RapidAPI] Found user ID: ${userId} for @${cleanHandle}`);

            // Step 2: Get user tweets with the numeric ID
            const tweetsUrl = `https://twitter241.p.rapidapi.com/user-tweets?user=${userId}&count=2`;
            
            const res = await fetch(tweetsUrl, {
                method: 'GET',
                headers: {
                    'x-rapidapi-key': process.env.RAPIDAPI_KEY,
                    'x-rapidapi-host': 'twitter241.p.rapidapi.com'
                }
            });

            if (res.ok) {
                const data = await res.json();
                console.log(`[RapidAPI] Tweets response:`, JSON.stringify(data).substring(0, 500));
                
                // Navigate the Twitter API response structure
                // Structure: result.timeline.instructions[].entries[] or instruction.entry
                let entries = [];
                const instructions = data.result?.timeline?.instructions || [];
                
                for (const instruction of instructions) {
                    // Handle TimelineAddEntries (has entries array)
                    if (instruction.entries) {
                        entries.push(...instruction.entries);
                    }
                    // Handle TimelinePinEntry (has single entry)
                    if (instruction.entry) {
                        entries.push(instruction.entry);
                    }
                }

                // Filter to only tweet entries (not cursors or promotions)
                const tweetEntries = entries.filter(e => 
                    e.entryId?.startsWith('tweet-') || 
                    e.content?.itemContent?.tweet_results
                );
                
                console.log(`[RapidAPI] Found ${tweetEntries.length} tweet entries for @${cleanHandle}`);

                if (tweetEntries.length > 0) {
                    const topEntry = tweetEntries[0];
                    const topTweet = topEntry?.content?.itemContent?.tweet_results?.result || topEntry;
                    const tweetId = topTweet.rest_id || topTweet.legacy?.id_str || topEntry.entryId?.replace('tweet-', '');
                    const tweetText = topTweet.legacy?.full_text || topTweet.text || '';

                    if (tweetId && luckyWinner.last_tweet_id !== tweetId) {
                         updates[luckyWinner.id] = {
                            id: tweetId,
                            text: tweetText,
                            link: `https://x.com/${cleanHandle}/status/${tweetId}`,
                            platform: 'X',
                            handle: luckyWinner.handle,
                            user_id: luckyWinner.user_id,
                            last_tweet_id: luckyWinner.last_tweet_id
                         };
                         console.log(`[RapidAPI] ✅ Found update for @${cleanHandle}: "${tweetText.substring(0, 50)}..."`);
                    } else {
                         results.push(`⏭️ @${cleanHandle}: No new updates`);
                    }
                } else {
                    console.log(`[RapidAPI] No tweets found in response for @${cleanHandle}`);
                }
            } else {
                const errorText = await res.text();
                console.error(`[RapidAPI] Tweets error ${res.status}: ${errorText.substring(0, 200)}`);
                if (res.status === 429) results.push(`❌ Rate Limit Hit`);
            }
        } catch (e) {
            console.error(`[RapidAPI] Failed: ${e.message}`);
        }
    } else if (twitterItems.length > 0 && !process.env.RAPIDAPI_KEY) {
        results.push(`ℹ️ Twitter: RAPIDAPI_KEY not configured`);
    }

    // =========================================================
    // STEP B: REDDIT (Free JSON API)
    // =========================================================
    const redditItems = watchlist.filter(i => i.platform === 'Reddit');
    
    for (const item of redditItems) {
        const cleanHandle = item.handle.replace(/[@\s]/g, '').trim();
        const isUser = cleanHandle.toLowerCase().startsWith('u/');
        const name = cleanHandle.replace(/^[ru]\//i, '');
        
        const endpoint = isUser
          ? `https://www.reddit.com/user/${name}/submitted.json?limit=1&sort=new`
          : `https://www.reddit.com/r/${name}/new.json?limit=1`;

        try {
            console.log(`[Reddit] Checking ${cleanHandle}...`);
            
            const res = await fetch(endpoint, {
                headers: { 'User-Agent': 'OrbitBot/1.0' },
                next: { revalidate: 0 }
            });

            if (res.ok) {
                const json = await res.json();
                const post = json?.data?.children?.[0]?.data;
                
                if (post && item.last_tweet_id !== post.id) {
                    updates[item.id] = {
                        id: post.id,
                        text: post.title || post.body || '[No title]',
                        link: `https://reddit.com${post.permalink}`,
                        platform: 'Reddit',
                        handle: item.handle,
                        user_id: item.user_id,
                        last_tweet_id: item.last_tweet_id
                    };
                    console.log(`[Reddit] ✅ Found update for ${cleanHandle}`);
                } else if (post) {
                    results.push(`⏭️ ${cleanHandle}: No new updates`);
                }
            } else {
                console.log(`[Reddit] ❌ HTTP ${res.status} for ${cleanHandle}`);
            }
        } catch (e) {
            console.log(`[Reddit] ❌ Error: ${e.message}`);
        }
    }

    // =========================================================
    // STEP C: YOUTUBE (Free RSS Feed)
    // =========================================================
    const youtubeItems = watchlist.filter(i => i.platform === 'YouTube');
    
    for (const item of youtubeItems) {
        const cleanHandle = item.handle.replace(/[@\s]/g, '').trim();
        const channelId = cleanHandle.startsWith('UC') ? cleanHandle : null;
        
        if (channelId) {
            try {
                console.log(`[YouTube] Checking ${channelId}...`);
                
                const res = await fetch(
                    `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`,
                    { next: { revalidate: 0 } }
                );

                if (res.ok) {
                    const xml = await res.text();
                    
                    // Extract channel name from RSS feed
                    const channelNameMatch = xml.match(/<author>.*?<name>(.*?)<\/name>/s);
                    const channelName = channelNameMatch ? channelNameMatch[1] : channelId;
                    
                    const titleMatch = xml.match(/<entry>.*?<title>(.*?)<\/title>/s);
                    const linkMatch = xml.match(/<entry>.*?<yt:videoId>(.*?)<\/yt:videoId>/s);
                    
                    if (titleMatch && linkMatch) {
                        const videoId = linkMatch[1];
                        
                        if (item.last_tweet_id !== videoId) {
                            updates[item.id] = {
                                id: videoId,
                                text: titleMatch[1],
                                link: `https://youtube.com/watch?v=${videoId}`,
                                platform: 'YouTube',
                                handle: channelName, // Use channel name instead of ID
                                user_id: item.user_id,
                                last_tweet_id: item.last_tweet_id
                            };
                            console.log(`[YouTube] ✅ Found update from ${channelName}: "${titleMatch[1].substring(0, 30)}..."`);
                        } else {
                            results.push(`⏭️ ${channelName}: No new updates`);
                        }
                    }
                }
            } catch (e) {
                console.log(`[YouTube] ❌ Error: ${e.message}`);
            }
        } else {
            results.push(`ℹ️ ${cleanHandle}: Use YouTube channel ID (starts with UC)`);
        }
    }

    // =========================================================
    // STEP D: SEND NOTIFICATIONS
    // =========================================================
    for (const itemId in updates) {
        const post = updates[itemId];

        // Skip if same as last time (deduplication)
        if (post.last_tweet_id === String(post.id)) {
            continue;
        }

        const { data: userProfile } = await supabaseAdmin
            .from('profiles')
            .select('email, phone')
            .eq('id', post.user_id)
            .single();

        if (userProfile) {
            let log = `✅ ${post.handle}: "${post.text?.substring(0, 25)}..."`;

            if (userProfile.email) {
                await sendNotification(
                    userProfile.email, 
                    post.handle, 
                    post.platform, 
                    `${post.text}\n\nLink: ${post.link}`
                );
                log += " → Email";
            }

            if (userProfile.phone) {
                await sendWhatsAppNotification(
                    userProfile.phone, 
                    post.handle, 
                    post.platform, 
                    `Orbit: New ${post.platform} post!\n${post.link}`
                );
                log += " → WhatsApp";
            }

            await supabaseAdmin
                .from('watchlist')
                .update({ last_tweet_id: String(post.id) })
                .eq('id', itemId);

            results.push(log);
        }
    }

    return NextResponse.json({ 
        success: true, 
        actions: results,
        timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Cron error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
