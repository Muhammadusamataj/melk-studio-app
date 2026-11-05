# TV and screen synchronization feasibility

This review concerns the commands present in `www/js/protocol.js` and the existing FFF0/FFF3 BLE controller profile. No screen synchronization or new hardware packet is implemented in v1.2.0.

| Capability | Evidence and conclusion |
| --- | --- |
| Whole-controller RGB | Existing RGB packets support one selected colour. A future screen-average feature could use this path, subject to hardware latency tests. |
| Native modes and scenes | 213 numbered modes and 28 scenes are controller programs. They do not establish externally addressable pixels or simultaneous independently assigned zones. |
| Per-pixel or segment writes | No verified packet builder, addressing specification, or controller response is present. Multi-zone Ambilight cannot responsibly be implemented against this evidence. |
| BLE bandwidth | Current command coalescing supports control changes. A per-zone frame format, MTU, write latency, throughput and controller buffering would need measurement before setting a frame-rate target. |
| Feedback | Available notifications do not establish a verified per-pixel capability query or current-effect readback. |

Single-colour screen sync is technically plausible as a separate future feature: obtain explicit MediaProjection consent, sample/downscale captured frames, compute a smoothed average, and send the existing RGB command at a measured bounded rate. It would require image-capture resources and foreground-service handling beyond the audio-only capture in this release. Test CPU, heat, latency, silence/dark scenes and disconnect behavior before shipping.

Multi-zone Ambilight needs a controller with documented independently addressable pixels/segments, verified zone commands and adequate transport throughput. Addressable LEDs alone are insufficient if the BLE controller only accepts built-in modes. Consider a documented network controller protocol and appropriate LED power supply if this hardware cannot provide those commands. Do not send speculative segment packets to this controller.

Android MediaProjection requires consent, is revocable and cannot bypass protected surfaces, DRM, source-app policy or secure windows. Protected video may appear black. A phone cannot directly capture another television's HDMI/display output. Android TV requires a supported app/device capture path; an HDMI capture device introduces HDCP, hardware and permission constraints. Those need device-specific evaluation.

Recommended next step: identify the controller chipset/firmware and obtain an authorized protocol specification or documented SDK. Validate one known segment operation on spare hardware before designing a multi-zone UI. Until then, keep v1.2.0 focused on verified native effects and audio synchronization.
