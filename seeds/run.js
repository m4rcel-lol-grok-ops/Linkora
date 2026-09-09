'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const argon2 = require('argon2');
const config = require('../src/config');

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
};

async function seed() {
  const pool = new Pool(
    config.database.url
      ? { connectionString: config.database.url }
      : {
          host: config.database.host,
          port: config.database.port,
          database: config.database.name,
          user: config.database.user,
          password: config.database.password,
        }
  );
  const client = await pool.connect();

  try {
    const existing = await client.query('SELECT COUNT(*)::int AS c FROM users');
    if (existing.rows[0].c > 0) {
      console.log('Database already has users; skipping seed.');
      return;
    }

    console.log('Seeding Linkora development data...');
    const passwordHash = await argon2.hash('password123', ARGON2_OPTIONS);

    const users = [
      { username: 'alice', display: 'Alice Rivera', email: 'alice@linkora.dev', bio: 'Coffee, code, and cats. #dev' },
      { username: 'bob', display: 'Bob Chen', email: 'bob@linkora.dev', bio: 'Building things on the web.' },
      { username: 'charlie', display: 'Charlie Okonkwo', email: 'charlie@linkora.dev', bio: 'Music & open source' },
      { username: 'diana', display: 'Diana Moss', email: 'diana@linkora.dev', bio: 'Designer. Pixel pusher.' },
      { username: 'linkora', display: 'Linkora', email: 'hello@linkora.dev', bio: 'Official Linkora account', verified: true },
      { username: 'devuser', display: 'Dev User', email: 'dev@linkora.dev', bio: 'Local development account' },
      { username: 'newsbot', display: 'News Bot', email: 'news@linkora.dev', bio: 'Automated news snippets (fictional)' },
    ];

    const ids = {};
    for (const u of users) {
      const { rows } = await client.query(
        `INSERT INTO users (username, username_lower, display_name, email, email_lower, password_hash, bio, is_verified, email_verified)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)
         RETURNING id`,
        [u.username, u.username, u.display, u.email, u.email, passwordHash, u.bio || '', !!u.verified]
      );
      ids[u.username] = rows[0].id;
      await client.query('INSERT INTO user_settings (user_id) VALUES ($1)', [rows[0].id]);
    }

    const followPairs = [
      ['alice', 'bob'], ['alice', 'charlie'], ['alice', 'linkora'],
      ['bob', 'alice'], ['bob', 'diana'], ['bob', 'linkora'],
      ['charlie', 'alice'], ['charlie', 'linkora'],
      ['diana', 'alice'], ['diana', 'bob'], ['diana', 'linkora'],
      ['devuser', 'alice'], ['devuser', 'bob'], ['devuser', 'linkora'],
      ['linkora', 'alice'], ['linkora', 'bob'],
    ];
    for (const [a, b] of followPairs) {
      await client.query(
        'INSERT INTO follows (follower_id, following_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [ids[a], ids[b]]
      );
    }
    for (const uname of Object.keys(ids)) {
      await client.query(
        `UPDATE users SET
           following_count = (SELECT COUNT(*) FROM follows WHERE follower_id = $1),
           followers_count = (SELECT COUNT(*) FROM follows WHERE following_id = $1)
         WHERE id = $1`,
        [ids[uname]]
      );
    }

    const tweets = [
      { user: 'linkora', text: 'Welcome to Linkora! A place to connect and share what is happening. #Linkora #hello' },
      { user: 'alice', text: 'Just shipped a new feature. Feeling good about this one. #dev #coding' },
      { user: 'bob', text: 'Does anyone else still prefer chronological timelines? Asking for a friend.' },
      { user: 'charlie', text: 'Listening to jazz and writing docs. Productive Sunday.' },
      { user: 'diana', text: 'Redesigning a form. The little details matter more than people think.' },
      { user: 'alice', text: 'Hot take: 140 characters was the perfect constraint. #design' },
      { user: 'newsbot', text: 'Fictional headline: City installs more bike lanes. Residents split. #news' },
      { user: 'bob', text: 'Working on database migrations so you do not have to. #postgres' },
      { user: 'linkora', text: 'Tip: Use hashtags and mentions to join conversations. Try following a few accounts!' },
      { user: 'devuser', text: 'Hello from the development seed. Password for all seed users is password123' },
    ];

    for (const t of tweets) {
      await client.query('INSERT INTO tweets (user_id, text) VALUES ($1, $2)', [ids[t.user], t.text]);
      const tags = t.text.match(/#(\w+)/g) || [];
      for (const raw of tags) {
        const tag = raw.slice(1);
        const tagLower = tag.toLowerCase();
        let ht = await client.query('SELECT id FROM hashtags WHERE tag_lower = $1', [tagLower]);
        if (!ht.rows[0]) {
          ht = await client.query(
            'INSERT INTO hashtags (tag, tag_lower, use_count) VALUES ($1, $2, 1) RETURNING id',
            [tag, tagLower]
          );
        } else {
          await client.query('UPDATE hashtags SET use_count = use_count + 1 WHERE id = $1', [ht.rows[0].id]);
        }
      }
    }

    await client.query(
      `UPDATE users u SET tweets_count = (SELECT COUNT(*) FROM tweets t WHERE t.user_id = u.id AND t.deleted_at IS NULL)`
    );

    const { rows: someTweets } = await client.query('SELECT id, user_id FROM tweets LIMIT 5');
    for (const tw of someTweets) {
      if (tw.user_id !== ids.alice) {
        await client.query(
          'INSERT INTO favorites (user_id, tweet_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [ids.alice, tw.id]
        );
        await client.query('UPDATE tweets SET favorites_count = favorites_count + 1 WHERE id = $1', [tw.id]);
      }
    }

    console.log('Seed complete.');
    console.log('Sample logins (password for all: password123):');
    console.log('  alice / bob / charlie / diana / linkora / devuser');
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
