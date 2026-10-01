import { getIntlTag } from '@/i18n/dateLocale';

export function getLocalTimezone() {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

type DateInput = Date | number | string;

export function formatDateTime(value: DateInput, timezone?: string | null) {
    // 24h clock for zh (hour12 only for en); tag follows the UI language.
    const tag = getIntlTag();
    return new Date(value).toLocaleString(tag, {
        timeZone: timezone || getLocalTimezone(),
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        ...(tag === 'en-US' ? { hour12: true } : { hour12: false }),
    });
}

export function formatDate(value: DateInput, timezone?: string | null) {
    return new Date(value).toLocaleDateString(getIntlTag(), {
        timeZone: timezone || getLocalTimezone(),
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}

export function formatCalendarDate(value: string) {
    const calendarDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!calendarDate) {
        return formatDate(value, 'UTC');
    }

    const [, year, month, day] = calendarDate;
    return formatDate(
        Date.UTC(Number(year), Number(month) - 1, Number(day)),
        'UTC',
    );
}

export function formatLocalDateTime(value: Date) {
    return `${value.toLocaleDateString()} ${value.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
    })}`;
}
