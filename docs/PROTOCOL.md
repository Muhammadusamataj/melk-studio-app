# MELK strip protocol

Decoded from **Magic Lantern 6.11.10** (`wl.smartled.rgb`, classes `BluetoothLEService` / `BluetoothUtil`).
Static analysis only. Packets were not captured from a live strip, so verify each one on your hardware.

## Transport
| Item | Value |
|---|---|
| Device name prefix | `MELK-` |
| GATT service | `0000fff0-0000-1000-8000-00805f9b34fb` |
| Write characteristic | `0000fff3-0000-1000-8000-00805f9b34fb` |
| Packet | 9 bytes, starts `7E`, ends `EF` |
| Pacing | the original app sleeps ~5 ms between writes; this project uses 35 ms and coalesces colour writes |

## Commands (confirmed in the decompiled byte-building code)
| Action | Bytes |
|---|---|
| Power on / off | `7E 04 04 on 00 on FF 00 EF` (on = 01, off = 00) |
| Colour | `7E 07 05 03 RR GG BB 10 EF` |
| Brightness 0–100 | `7E 04 01 BB FF FF FF 00 EF` |
| Mode speed 0–100 | `7E 04 02 SS FF FF FF 00 EF` |
| Built-in mode | `7E 05 03 MM 06 FF FF 00 EF` |
| White (warm, cold 0–100) | `7E 06 05 02 WW CC FF 08 EF` |

## Found but not implemented yet
| Action | Notes |
|---|---|
| Scene | byte 3 of the packet carries a `0x31` marker; the app routes mode id 156 here |
| Pin sequence | `7E .. 81 ..` family |
| Symphony point | `7E 07 21 lo hi 00 FF 00 EF` |
| Mic EQ mode / sensitivity / on-off | exposed by the app's streaming screen |
| System time + timer slots | `0x83` (set time) and `0x82` (timer) packets; the original app reads them back from the strip |

## Open questions
* **Mode IDs.** The app's mode list lives in a lookup table (`PickersBean.showId`). Mode 156 (`0x9C`) is special-cased to the scene command, which fits the common `0x80–0x9C` range, so this project lists 128–155. The Studio tab has a **Try any mode number** box to confirm or extend that range.
* **Brightness byte 4.** The original passes a "light mode" value (all = 0, RGB = 1, W = 2, CT = 3) and defaults to `FF` when none is set. We send `FF`.
