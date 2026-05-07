import { postTrip } from "./api.js";
export function setupTripForm(tripForm, loadTrips){
    tripForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const formData = new FormData(tripForm);
        const name = String(formData.get("name") || "").trim();
        if (!name) {
            return;
        }
        await postTrip(name);
        tripForm.reset();
        await loadTrips();
    });
}