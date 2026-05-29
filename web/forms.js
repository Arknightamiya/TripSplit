import { postTrip } from "./api.js";

const STRICT_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MIN_DATE = "0001-01-01";
const MAX_DATE = "9999-12-31";
const DATE_FORMAT_ERROR = "Use YYYY-MM-DD with a 4-digit year.";

export function setupDateInputs(root = document) {
    root.querySelectorAll("input[type='date']").forEach((input) => {
        input.min = input.min || MIN_DATE;
        input.max = input.max || MAX_DATE;
        input.addEventListener("input", () => validateDateInput(input));
        input.addEventListener("change", () => validateDateInput(input));
    });
}

export function setupTripForm(tripForm, loadTrips){
    tripForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const formData = new FormData(tripForm);
        const name = String(formData.get("name") || "").trim();
        const visibility = formData.get("isPrivate") === "on" ? "private" : "public";
        const startDate = String(formData.get("startDate") || "").trim();
        const endDate = String(formData.get("endDate") || "").trim();
        if (!name) {
            return;
        }

        const dateError = validateTripDates(tripForm);
        if (dateError) {
            tripForm.reportValidity();
            return;
        }
        await postTrip({ name, visibility, startDate, endDate });
        tripForm.reset();
        await loadTrips();
    });
}

export function validateTripDates(form) {
    const startDateInput = form.elements.startDate;
    const endDateInput = form.elements.endDate;

    const startDateError = validateDateInput(startDateInput);
    const endDateError = validateDateInput(endDateInput);
    if (startDateError || endDateError) {
        return startDateError || endDateError;
    }

    const startDate = String(startDateInput?.value || "").trim();
    const endDate = String(endDateInput?.value || "").trim();
    if (startDate && endDate && endDate < startDate) {
        endDateInput.setCustomValidity("End date must be on or after start date.");
        return "End date must be on or after start date.";
    }

    endDateInput?.setCustomValidity("");
    return "";
}

function validateDateInput(input) {
    if (!input) {
        return "";
    }

    const value = String(input.value || "").trim();
    input.setCustomValidity("");

    if (!value) {
        return "";
    }

    if (!STRICT_DATE_PATTERN.test(value)) {
        input.setCustomValidity(DATE_FORMAT_ERROR);
        return DATE_FORMAT_ERROR;
    }

    if (value < MIN_DATE || value > MAX_DATE || !isValidCalendarDate(value)) {
        const message = "Enter a valid date between 0001-01-01 and 9999-12-31.";
        input.setCustomValidity(message);
        return message;
    }

    return "";
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
