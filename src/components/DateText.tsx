const RELATIVE_DATE_THRESHOLD_MS = 48 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

const relativeTimeFormatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const absoluteDateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
const absoluteDateWithYearFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
const absoluteTitleFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

export function DateStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <strong>
        <DateText value={value} />
      </strong>
      <span>{label}</span>
    </div>
  );
}

export function DateLine({ label, value }: { label: string; value: string }) {
  return (
    <span>
      {label} <DateText value={value} />
    </span>
  );
}

export function DateText({ value }: { value: string }) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return (
    <time dateTime={value} title={formatAbsoluteTitle(date)}>
      {formatDateForDisplay(date)}
    </time>
  );
}

export function FileDateMeta({
  createdAt,
  updatedAt,
}: {
  createdAt?: string;
  updatedAt?: string;
}) {
  if (!createdAt && !updatedAt) {
    return null;
  }

  return (
    <p className="file-date-meta">
      {updatedAt ? (
        <>
          Updated <DateText value={updatedAt} />
        </>
      ) : null}
      {updatedAt && createdAt ? <span aria-hidden="true"> · </span> : null}
      {createdAt ? (
        <>
          Created <DateText value={createdAt} />
        </>
      ) : null}
    </p>
  );
}

function formatDateForDisplay(date: Date) {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const ageMs = Math.abs(diffMs);

  if (ageMs < RELATIVE_DATE_THRESHOLD_MS) {
    if (ageMs < MINUTE_MS) {
      return "just now";
    }

    if (ageMs < 5 * MINUTE_MS) {
      return diffMs < 0 ? "a few minutes ago" : "in a few minutes";
    }

    if (ageMs < HOUR_MS) {
      return relativeTimeFormatter.format(Math.round(diffMs / MINUTE_MS), "minute");
    }

    if (ageMs < DAY_MS) {
      return relativeTimeFormatter.format(Math.round(diffMs / HOUR_MS), "hour");
    }

    return relativeTimeFormatter.format(Math.round(diffMs / DAY_MS), "day");
  }

  return isSameYear(date, now)
    ? absoluteDateFormatter.format(date)
    : absoluteDateWithYearFormatter.format(date);
}

function formatAbsoluteTitle(date: Date) {
  return absoluteTitleFormatter.format(date);
}

function isSameYear(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear();
}
