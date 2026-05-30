import { postTrip } from "./api.js";

const STRICT_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MIN_DATE = "0001-01-01";
const MAX_DATE = "9999-12-31";
const DATE_FORMAT_ERROR = "Use MM/DD/YYYY.";
const DIGITS_ONLY_ERROR = "Use numbers only for dates.";
const MONTH_RANGE_ERROR = "Month must be between 1 and 12.";
const DAY_RANGE_ERROR = "Day must be between 1 and 31.";
const YEAR_FORMAT_ERROR = "Year must be 4 digits.";
const MONTH_NAMES = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December"
];
const WEEKDAY_NAMES = ["S", "M", "T", "W", "T", "F", "S"];

let activeCalendarField = null;
let calendarPopover = null;
let calendarWheelDelta = 0;
let calendarLastWheelAt = 0;

export function setupDateInputs(root = document) {
    root.querySelectorAll("[data-date-field]").forEach((field) => setupSegmentedDateField(field));
}

export function setupTripForm(tripForm, loadTrips, options = {}) {
    tripForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const formData = new FormData(tripForm);
        const name = String(formData.get("name") || "").trim();
        const visibility = formData.get("isPrivate") === "on" ? "private" : "public";
        const startDate = String(formData.get("startDate") || "").trim();
        const endDate = String(formData.get("endDate") || "").trim();
        const inviteeUserIds = options.getInviteeUserIds?.() || [];
        if (!name) {
            return;
        }

        const dateError = validateTripDates(tripForm);
        if (dateError) {
            tripForm.reportValidity();
            return;
        }
        await postTrip({ name, visibility, startDate, endDate, inviteeUserIds });
        tripForm.reset();
        options.onCreated?.();
        await loadTrips();
    });
}

export function setDateInputValue(form, name, value) {
    const field = getDateField(form, name);
    if (!field) {
        const input = form.elements[name];
        if (input) {
            input.value = value || "";
        }
        return;
    }

    setDateFieldFromIso(field, value || "");
}

export function validateTripDates(form) {
    const startDateError = validateDateField(getDateField(form, "startDate"));
    const endDateError = validateDateField(getDateField(form, "endDate"));
    if (startDateError || endDateError) {
        return startDateError || endDateError;
    }

    const startDate = String(form.elements.startDate?.value || "").trim();
    const endDate = String(form.elements.endDate?.value || "").trim();
    const endField = getDateField(form, "endDate");
    if (startDate && endDate && endDate < startDate) {
        setDateFieldValidity(endField, "End date must be on or after start date.");
        return "End date must be on or after start date.";
    }

    setDateFieldValidity(endField, "");
    return "";
}

function setupSegmentedDateField(field) {
    if (field.dataset.dateReady === "true") {
        return;
    }

    field.dataset.dateReady = "true";
    const parts = getDateParts(field);
    const hidden = getHiddenDateInput(field);
    const picker = getPickerButton(field);

    parts.forEach((input) => {
        input.addEventListener("beforeinput", (event) => handleDateBeforeInput(event, field));
        input.addEventListener("input", () => handleDateInput(input, field));
        input.addEventListener("keydown", (event) => handleDateSegmentKeydown(event, field));
        input.addEventListener("pointerdown", () => markFocusedDatePart(input, field));
        input.addEventListener("click", () => markFocusedDatePart(input, field));
        input.addEventListener("focus", () => markFocusedDatePart(input, field));
        input.addEventListener("blur", () => {
            input.classList.remove("is-focused");
            updateHiddenDateValue(field);
        });
    });

    picker?.addEventListener("pointerdown", () => primeDatePickerDefault(field));
    picker?.addEventListener("click", (event) => {
        event.preventDefault();
        toggleCalendar(field);
    });
    picker?.addEventListener("keydown", (event) => handlePickerKeydown(event, field));

    hidden?.form?.addEventListener("reset", () => {
        window.setTimeout(() => {
            parts.forEach((input) => {
                input.value = "";
                input.setCustomValidity("");
            });
            if (hidden) {
                hidden.value = "";
            }
            if (picker) {
                updatePickerButtonLabel(field);
            }
            closeCalendar(field);
        }, 0);
    });

    setDateFieldFromIso(field, hidden?.value || "");
}

function markFocusedDatePart(input, field) {
    getDateParts(field).forEach((part) => part.classList.toggle("is-focused", part === input));
}

function handleDateBeforeInput(event, field) {
    if (event.inputType && !event.inputType.includes("insert")) {
        return;
    }

    const input = event.currentTarget;
    const data = event.data || "";
    if (!data) {
        return;
    }

    if (!/^\d+$/.test(data)) {
        event.preventDefault();
        showDateFieldWarning(input, DIGITS_ONLY_ERROR);
        return;
    }

    const nextValue = getNextInputValue(input, data);
    const error = validateDatePartInput(input.dataset.datePart, nextValue);
    if (error) {
        event.preventDefault();
        showDateFieldWarning(input, error);
        return;
    }

    clearDatePartValidity(field);
}

function handleDateInput(input, field) {
    const part = input.dataset.datePart;
    const maxLength = part === "year" ? 4 : 2;
    const digits = input.value.replace(/\D/g, "").slice(0, maxLength);
    const error = validateDatePartInput(part, digits);

    if (error) {
        input.value = input.dataset.lastValidValue || "";
        showDateFieldWarning(input, error);
        return;
    }

    input.value = digits;
    input.dataset.lastValidValue = digits;
    updateHiddenDateValue(field);
    advanceDatePartFocus(input, field);
}

function handleDateSegmentKeydown(event, field) {
    if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
    }

    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
        return;
    }

    const input = event.currentTarget;
    const parts = getDateParts(field);
    const index = parts.indexOf(input);
    const selectionStart = input.selectionStart ?? 0;
    const selectionEnd = input.selectionEnd ?? input.value.length;
    const hasRangeSelection = selectionStart !== selectionEnd;

    if (event.key === "ArrowLeft" && index > 0 && !hasRangeSelection && selectionStart === 0) {
        event.preventDefault();
        focusDatePart(parts[index - 1], "end");
    }

    if (
        event.key === "ArrowRight" &&
        index >= 0 &&
        index < parts.length - 1 &&
        !hasRangeSelection &&
        selectionEnd === input.value.length
    ) {
        event.preventDefault();
        focusDatePart(parts[index + 1], "start");
    }
}

function focusDatePart(input, position) {
    input.focus();
    const cursorPosition = position === "end" ? input.value.length : 0;
    input.setSelectionRange(cursorPosition, cursorPosition);
}

function advanceDatePartFocus(input, field) {
    const parts = getDateParts(field);
    const month = parts.find((part) => part.dataset.datePart === "month");
    const day = parts.find((part) => part.dataset.datePart === "day");
    const year = parts.find((part) => part.dataset.datePart === "year");

    if (input === month && input.value.length === 2) {
        day?.focus();
        return;
    }

    if (input === day && input.value.length === 2 && month?.value) {
        year?.focus();
        return;
    }

    if (input === year && input.value.length === 4 && hasCompleteDateParts(field)) {
        if (field.dataset.name === "startDate") {
            getDateField(field.closest("form"), "endDate")
                ?.querySelector("[data-date-part='month']")
                ?.focus();
        } else {
            input.blur();
        }
    }
}

function updateHiddenDateValue(field) {
    const hidden = getHiddenDateInput(field);
    if (!hidden) {
        return;
    }

    hidden.value = hasCompleteDateParts(field) ? getIsoDateFromField(field) : "";
    updatePickerButtonLabel(field);
}

function primeDatePickerDefault(field) {
    const picker = getPickerButton(field);
    const hidden = getHiddenDateInput(field);
    if (!picker || hidden?.value || hasAnyDatePartValue(field)) {
        return;
    }

    const today = parseIsoDate(getTodayIsoDate());
    field.dataset.calendarYear = String(today.year);
    field.dataset.calendarMonth = String(today.month);
}

function handlePickerKeydown(event, field) {
    if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggleCalendar(field);
    }

    if (event.key === "Escape") {
        closeCalendar(field);
    }
}

function toggleCalendar(field) {
    if (activeCalendarField === field && calendarPopover && !calendarPopover.hidden) {
        closeCalendar(field);
        return;
    }

    openCalendar(field);
}

function openCalendar(field) {
    primeDatePickerDefault(field);
    activeCalendarField = field;
    const viewDate = getCalendarViewDate(field);
    field.dataset.calendarYear = String(viewDate.year);
    field.dataset.calendarMonth = String(viewDate.month);
    renderCalendar(field);
    positionCalendar(field);
}

function closeCalendar(field = activeCalendarField) {
    if (!calendarPopover || !field || activeCalendarField !== field) {
        return;
    }

    calendarPopover.hidden = true;
    activeCalendarField = null;
    getPickerButton(field)?.setAttribute("aria-expanded", "false");
}

function ensureCalendarPopover() {
    if (calendarPopover) {
        return calendarPopover;
    }

    calendarPopover = document.createElement("div");
    calendarPopover.className = "date-calendar";
    calendarPopover.hidden = true;
    document.body.append(calendarPopover);

    calendarPopover.addEventListener("wheel", (event) => {
        if (!activeCalendarField) {
            return;
        }

        event.preventDefault();
        handleCalendarWheel(event);
    }, { passive: false });

    document.addEventListener("pointerdown", (event) => {
        if (!activeCalendarField || calendarPopover.hidden) {
            return;
        }

        if (calendarPopover.contains(event.target) || activeCalendarField.contains(event.target)) {
            return;
        }

        closeCalendar(activeCalendarField);
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && activeCalendarField) {
            closeCalendar(activeCalendarField);
        }
    });

    window.addEventListener("resize", () => {
        if (activeCalendarField) {
            positionCalendar(activeCalendarField);
        }
    });

    return calendarPopover;
}

function renderCalendar(field) {
    const popover = ensureCalendarPopover();
    const year = Number(field.dataset.calendarYear);
    const month = Number(field.dataset.calendarMonth);
    const selected = parseIsoDate(getHiddenDateInput(field)?.value || "");
    const today = parseIsoDate(getTodayIsoDate());
    const title = `${MONTH_NAMES[month - 1]} ${year}`;

    popover.hidden = false;
    popover.setAttribute("role", "dialog");
    popover.setAttribute("aria-label", `${field.dataset.label || "Date"} calendar`);
    popover.innerHTML = `
        <div class="date-calendar-header">
            <strong>${title}</strong>
            <div class="date-calendar-nav">
                <button type="button" class="date-calendar-nav-button" data-calendar-action="previous" aria-label="Previous month">↑</button>
                <button type="button" class="date-calendar-nav-button" data-calendar-action="next" aria-label="Next month">↓</button>
            </div>
        </div>
        <div class="date-calendar-weekdays">
            ${WEEKDAY_NAMES.map((name) => `<span>${name}</span>`).join("")}
        </div>
        <div class="date-calendar-grid"></div>
        <div class="date-calendar-actions">
            <button type="button" data-calendar-action="clear">Clear</button>
            <button type="button" data-calendar-action="today">Today</button>
        </div>
    `;

    const grid = popover.querySelector(".date-calendar-grid");
    const firstVisibleDate = addDays({ year, month, day: 1 }, -getDayOfWeek(year, month, 1));
    for (let index = 0; index < 42; index += 1) {
        const date = addDays(firstVisibleDate, index);
        const button = document.createElement("button");
        const isCurrentMonth = date.month === month && date.year === year;
        const isSelectable = date.year >= 1 && date.year <= 9999;
        button.type = "button";
        button.className = "date-calendar-day";
        button.textContent = String(date.day);
        button.dataset.isoDate = isSelectable ? isoFromDateParts(date) : "";
        button.disabled = !isSelectable;
        button.classList.toggle("is-outside-month", !isCurrentMonth);
        button.classList.toggle("is-selected", Boolean(selected && isSameDate(date, selected)));
        button.classList.toggle("is-today", isSameDate(date, today));
        button.classList.toggle("is-default-date", Boolean(!selected && isSameDate(date, today)));
        button.setAttribute("aria-label", `${MONTH_NAMES[date.month - 1]} ${date.day}, ${date.year}`);
        grid.append(button);
    }

    popover.querySelector("[data-calendar-action='previous']").addEventListener("click", () => moveCalendarMonth(field, -1));
    popover.querySelector("[data-calendar-action='next']").addEventListener("click", () => moveCalendarMonth(field, 1));
    popover.querySelector("[data-calendar-action='clear']").addEventListener("click", () => {
        setDateFieldFromIso(field, "");
        closeCalendar(field);
    });
    popover.querySelector("[data-calendar-action='today']").addEventListener("click", () => {
        selectCalendarDate(field, getTodayIsoDate());
    });
    grid.addEventListener("click", (event) => {
        const button = event.target.closest("[data-iso-date]");
        if (!button || !button.dataset.isoDate) {
            return;
        }

        selectCalendarDate(field, button.dataset.isoDate);
    });

    getPickerButton(field)?.setAttribute("aria-expanded", "true");
}

function positionCalendar(field) {
    const popover = ensureCalendarPopover();
    const picker = getPickerButton(field);
    if (!picker) {
        return;
    }

    const rect = picker.getBoundingClientRect();
    const width = Math.min(320, window.innerWidth - 16);
    const left = Math.min(Math.max(8, rect.right - width), window.innerWidth - width - 8);
    popover.style.width = `${width}px`;
    popover.style.left = `${left}px`;
    popover.style.top = `${rect.bottom + 8 + window.scrollY}px`;
}

function moveCalendarMonth(field, offset) {
    const viewDate = getCalendarViewDate(field);
    const monthIndex = viewDate.year * 12 + (viewDate.month - 1) + offset;
    const nextYear = Math.floor(monthIndex / 12);
    const nextMonth = (monthIndex % 12) + 1;
    if (nextYear < 1 || nextYear > 9999) {
        return;
    }

    field.dataset.calendarYear = String(nextYear);
    field.dataset.calendarMonth = String(nextMonth);
    renderCalendar(field);
    positionCalendar(field);
}

function handleCalendarWheel(event) {
    const now = window.performance.now();
    if (now - calendarLastWheelAt > 260 || Math.sign(calendarWheelDelta) !== Math.sign(event.deltaY)) {
        calendarWheelDelta = 0;
    }

    calendarLastWheelAt = now;
    calendarWheelDelta += event.deltaY;
    if (Math.abs(calendarWheelDelta) < 120) {
        return;
    }

    moveCalendarMonth(activeCalendarField, calendarWheelDelta > 0 ? 1 : -1);
    calendarWheelDelta = 0;
}

function selectCalendarDate(field, value) {
    setDateFieldFromIso(field, value);
    validateDateField(field);
    closeCalendar(field);
}

function getCalendarViewDate(field) {
    const storedYear = Number(field.dataset.calendarYear);
    const storedMonth = Number(field.dataset.calendarMonth);
    if (storedYear >= 1 && storedYear <= 9999 && storedMonth >= 1 && storedMonth <= 12) {
        return { year: storedYear, month: storedMonth };
    }

    const hiddenDate = parseIsoDate(getHiddenDateInput(field)?.value || "");
    if (hiddenDate) {
        return { year: hiddenDate.year, month: hiddenDate.month };
    }

    const today = parseIsoDate(getTodayIsoDate());
    return { year: today.year, month: today.month };
}

function updatePickerButtonLabel(field) {
    const picker = getPickerButton(field);
    if (!picker) {
        return;
    }

    const value = getHiddenDateInput(field)?.value || "";
    picker.setAttribute("aria-label", value ? `${field.dataset.label || "Date"} ${value}` : `Choose ${field.dataset.label || "date"}`);
}

function validateDateField(field) {
    if (!field) {
        return "";
    }

    const parts = getDateParts(field);
    const hasAnyValue = parts.some((part) => part.value);
    if (!hasAnyValue) {
        setDateFieldValidity(field, "");
        return "";
    }

    if (!hasCompleteDateParts(field)) {
        setDateFieldValidity(field, DATE_FORMAT_ERROR);
        return DATE_FORMAT_ERROR;
    }

    const isoDate = getIsoDateFromField(field);
    if (!STRICT_DATE_PATTERN.test(isoDate)) {
        setDateFieldValidity(field, DATE_FORMAT_ERROR);
        return DATE_FORMAT_ERROR;
    }

    if (isoDate < MIN_DATE || isoDate > MAX_DATE || !isValidCalendarDate(isoDate)) {
        const message = "Enter a valid date between 0001-01-01 and 9999-12-31.";
        setDateFieldValidity(field, message);
        return message;
    }

    setDateFieldValidity(field, "");
    updateHiddenDateValue(field);
    return "";
}

function validateDatePartInput(part, value) {
    if (!value) {
        return "";
    }

    if (!/^\d+$/.test(value)) {
        return DIGITS_ONLY_ERROR;
    }

    if (part === "month" && value.length === 2) {
        const month = Number(value);
        return month >= 1 && month <= 12 ? "" : MONTH_RANGE_ERROR;
    }

    if (part === "day" && value.length === 2) {
        const day = Number(value);
        return day >= 1 && day <= 31 ? "" : DAY_RANGE_ERROR;
    }

    if (part === "year" && value.length > 4) {
        return YEAR_FORMAT_ERROR;
    }

    return "";
}

function getNextInputValue(input, data) {
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    return `${input.value.slice(0, start)}${data}${input.value.slice(end)}`;
}

function setDateFieldFromIso(field, value) {
    const hidden = getHiddenDateInput(field);
    const month = field.querySelector("[data-date-part='month']");
    const day = field.querySelector("[data-date-part='day']");
    const year = field.querySelector("[data-date-part='year']");
    const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);

    year.value = match ? match[1] : "";
    month.value = match ? match[2] : "";
    day.value = match ? match[3] : "";
    [month, day, year].forEach((part) => {
        part.dataset.lastValidValue = part.value;
        part.setCustomValidity("");
    });
    if (hidden) {
        hidden.value = match ? value : "";
    }
    if (match) {
        field.dataset.calendarYear = String(Number(match[1]));
        field.dataset.calendarMonth = String(Number(match[2]));
    } else {
        delete field.dataset.calendarYear;
        delete field.dataset.calendarMonth;
    }
    updatePickerButtonLabel(field);
}

function getIsoDateFromField(field) {
    const month = field.querySelector("[data-date-part='month']")?.value || "";
    const day = field.querySelector("[data-date-part='day']")?.value || "";
    const year = field.querySelector("[data-date-part='year']")?.value || "";

    return `${year.padStart(4, "0")}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function hasCompleteDateParts(field) {
    const month = field.querySelector("[data-date-part='month']")?.value || "";
    const day = field.querySelector("[data-date-part='day']")?.value || "";
    const year = field.querySelector("[data-date-part='year']")?.value || "";

    return month.length >= 1 && day.length >= 1 && year.length === 4;
}

function hasAnyDatePartValue(field) {
    return getDateParts(field).some((part) => part.value);
}

function setDateFieldValidity(field, message) {
    const target = field?.querySelector("[data-date-part='month']");
    if (target) {
        target.setCustomValidity(message);
    }
}

function clearDatePartValidity(field) {
    getDateParts(field).forEach((part) => part.setCustomValidity(""));
}

function showDateFieldWarning(input, message) {
    input.setCustomValidity(message);
    input.reportValidity();
}

function getDateField(form, name) {
    return form?.querySelector(`[data-date-field][data-name="${name}"]`) || null;
}

function getDateParts(field) {
    return Array.from(field?.querySelectorAll("[data-date-part]") || []);
}

function getHiddenDateInput(field) {
    return field?.querySelector("input[type='hidden']") || null;
}

function getPickerButton(field) {
    return field?.querySelector(".date-picker") || null;
}

function getTodayIsoDate() {
    const today = new Date();
    const year = String(today.getFullYear()).padStart(4, "0");
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function parseIsoDate(value) {
    const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {
        return null;
    }

    return {
        year: Number(match[1]),
        month: Number(match[2]),
        day: Number(match[3])
    };
}

function isoFromDateParts(date) {
    return `${String(date.year).padStart(4, "0")}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
}

function getDayOfWeek(year, month, day) {
    const date = new Date(Date.UTC(year, month - 1, day));
    date.setUTCFullYear(year);
    return date.getUTCDay();
}

function addDays(dateParts, offset) {
    const date = new Date(Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day));
    date.setUTCFullYear(dateParts.year);
    date.setUTCDate(date.getUTCDate() + offset);
    return {
        year: date.getUTCFullYear(),
        month: date.getUTCMonth() + 1,
        day: date.getUTCDate()
    };
}

function isSameDate(left, right) {
    return Boolean(
        left &&
        right &&
        left.year === right.year &&
        left.month === right.month &&
        left.day === right.day
    );
}

function isValidCalendarDate(value) {
    const [year, month, day] = value.split("-").map(Number);

    if (year < 1 || year > 9999 || month < 1 || month > 12 || day < 1) {
        return false;
    }

    const daysInMonth = [
        31,
        isLeapYear(year) ? 29 : 28,
        31,
        30,
        31,
        30,
        31,
        31,
        30,
        31,
        30,
        31
    ];

    return day <= daysInMonth[month - 1];
}

function isLeapYear(year) {
    return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}
