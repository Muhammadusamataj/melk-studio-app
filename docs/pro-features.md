# MELK Studio: Free vs Pro

Principle: everything that makes the strip work safely and feels good in a car stays free.
Pro adds customization and convenience for people who use the app a lot.

## Free (always)
- Connect, power, brightness, colour wheel, saved colours (up to 5)
- Built-in strip modes and the 5 preset effects
- Scenes: all 11 built-in scenes (Relax, Movie, Reading, Dinner, Party, Focus, Morning, Sleep, Night drive, Cruise, Parked chill) and Auto
- Car mode with its 4 scenes and dim screen
- Sleep timer, smooth fades, auto-reconnect
- Music sync (microphone in browser, phone audio in the APK)
- Sunset dimming
- Home screen shortcut links for up to 4 scenes
- Settings backup to file

## Pro (one-time purchase)
- Unlimited custom scenes (free: 3 custom scenes)
- Custom effect builder with your own colour steps (free: use the 5 presets)
- Unlimited saved colours (free: 5)
- Unlimited home screen shortcut links (free: 4)
- Music styles and sensitivity presets beyond the default two
- Extra app colour themes

## Not paywalled, ever
- Car mode and its safety-related brightness limits
- Auto-reconnect
- Sunset dimming
- Any future security or safety feature

## Pricing (starting point, adjust after launch)
- Pro one-time: USD 3.99 (Play sets local prices by country; check PKR price in the console)
- Keep the price one-time, not monthly, for a small tool like this.

## Build order
1. Free version to Play Internal testing (no billing code yet).
2. Add Play Billing (one-time product "pro_unlock") after the free app is live.
3. Gate the Pro items above behind a single `isPro()` check, so the free build still works offline.
