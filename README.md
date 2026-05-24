# Chess Arena

**Built because we got tired of cloning Chess.com.**

https://chess-arena-ten.vercel.app/ 


use pc for better experience of ui 

This isn't another Chess.com clone. It's a real-time PvP chess platform built from scratch — because cloning Chess.com is boring and the original is overrated.

## Why This Is Better Than Chess.com

- **No subscriptions.** Play unlimited PvP matches for free. No premium tier, no paywalled features.
- **No ads, no tracking, no bloat.** Just chess. The board, the clock, your opponent.
- **Distributed by design.** YugabyteDB cluster means your games are stored across multiple nodes — no single point of failure.
- **Serverless first.** No Express server, no Socket.IO — everything runs on Next.js API routes.
- **Clean, dark UI.** No flashing banners, no distraction. Focus on the game.
- **Your data, your rules.** Open-source and self-hostable.
**you can play with ai and also play with your friends**


## Getting Started
```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Fill in your Clerk keys and YugabyteDB credentials

# Run development server
npm run dev

# Build for production
npm run build
```

## Architecture

```
src/app/api/          → Serverless API routes (matches, challenges, social, auth)
src/app/arena/        → Live PvP chess arena with REST polling
src/app/profile/      → User profile, match history, social features
src/app/academy/      → Learning portal (tactics, openings, endgames, video lessons)
src/lib/              → Database singleton pool, migrations
src/hooks/            → React hooks (useSocial, useGame)
```

PvP matches work through REST API polling (800ms interval). No Socket.IO, no Express server. Both players see moves in real-time without page refresh.

## License

MIT
