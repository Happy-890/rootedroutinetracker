import type { ReactNode } from "react";
import { formatReminderTime } from "@/lib/rooted/reminder-time";

type NotificationBannerProps = {
  title: string;
  message: string;
  time: string;
  editControl?: ReactNode;
  status?: string;
};

/** Notification preview using the same icon file as the push worker and PWA. */
export function NotificationBanner({
  title,
  message,
  time,
  editControl,
  status,
}: NotificationBannerProps) {
  return (
    <div className="relative left-1/2 flex w-[95vw] min-w-0 -translate-x-1/2 items-center gap-3 rounded-[1.75rem] border border-black/[0.06] bg-[#e9e9eb] px-3 py-2.5 font-[system-ui] text-[#1c1c1e] shadow-[0_2px_10px_rgba(0,0,0,0.12)] min-[576px]:static min-[576px]:w-auto min-[576px]:translate-x-0 dark:border-white/[0.08] dark:bg-[#2c2c2e] dark:text-[#dedede]">
      <img
        src="/icons/icon-192.png"
        alt=""
        width={36}
        height={36}
        className="size-9 shrink-0 rounded-[0.625rem] ring-1 ring-black/10 dark:ring-white/10"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="min-w-0 break-words text-[14px] font-semibold leading-tight">
            {title || "New reminder"}
          </h3>
          <time
            dateTime={time || undefined}
            className="shrink-0 text-[11px] leading-tight text-black/45 dark:text-white/45"
          >
            {formatReminderTime(time)}
          </time>
        </div>
        <div className="mt-0.5 flex min-h-7 items-center justify-between gap-2">
          <p className="text-[14px] font-semibold leading-tight">from Rooted</p>
          <div className="flex shrink-0 items-center gap-1.5">
            {status && (
              <span className="text-[10px] text-black/50 dark:text-white/50">{status}</span>
            )}
            {editControl}
          </div>
        </div>
        <p className="mt-0.5 line-clamp-2 break-words text-[14px] font-normal leading-snug">
          {message}
        </p>
      </div>
    </div>
  );
}
