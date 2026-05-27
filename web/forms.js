import { postTrip } from "./api.js";
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
        if (startDate && endDate && endDate < startDate) {
            tripForm.elements.endDate.setCustomValidity("End date must be after start date.");
            tripForm.elements.endDate.reportValidity();
            return;
        }
        tripForm.elements.endDate.setCustomValidity("");
        await postTrip({ name, visibility, startDate, endDate });
        tripForm.reset();
        await loadTrips();
    });
}
