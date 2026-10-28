import { formatReminderTime } from "@/lib/rooted/reminder-time";

type NotificationBannerProps = {
  title: string;
  message: string;
  time: string;
};

/** Notification preview using the same icon file as the push worker and PWA. */
export function NotificationBanner({ title, message, time }: NotificationBannerProps) {
  return (
    <div className="flex min-w-0 items-center gap-3.5 rounded-[2.5rem] bg-[#e9e9eb] px-4 py-4 font-[system-ui] text-[#1c1c1e] shadow-sm dark:bg-[#1e1e1e] dark:text-[#dedede]">
      <img
        src="/icons/icon-192.png"
        alt=""
        width={44}
        height={44}
        className="size-11 shrink-0 rounded-[0.875rem] ring-1 ring-black/10 dark:ring-white/10"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="min-w-0 break-words text-[17px] font-semibold leading-tight">
            {title || "New reminder"}
          </h3>
          <time
            dateTime={time || undefined}
            className="shrink-0 text-[13px] leading-tight text-black/45 dark:text-white/45"
          >
            {formatReminderTime(time)}
          </time>
        </div>
        <p className="mt-0.5 text-[17px] font-semibold leading-tight">from Rooted</p>
        <p className="mt-1 line-clamp-2 break-words text-[17px] font-normal leading-snug">
          {message}
        </p>
      </div>
    </div>
  );
}
