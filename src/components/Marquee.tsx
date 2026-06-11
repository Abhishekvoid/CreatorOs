
import { Check } from "./ui";

const ITEMS = [
  "0% commission on every booking",
  "Instant UPI settlement",
  "WhatsApp reminders built in",
  "Google Calendar sync",
  "Sell digital products",
  "Set up in 5 minutes",
];

export default function Marquee() {
  return (
    <div className="overflow-hidden border-y border-line bg-paper py-4.5" aria-hidden="true">
      <div className="flex w-max animate-marquee gap-12 hover:[animation-play-state:paused]">
        {[...ITEMS, ...ITEMS].map((item, i) => (
          <div key={i} className="flex items-center gap-2.5 whitespace-nowrap text-[13.5px] font-bold text-muted">
            <Check className="size-4 shrink-0 text-terra" />
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}
