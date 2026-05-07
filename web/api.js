import { API_BASE } from "/shared/contracts.js";

export async function fetchHealth(){
      const response = await fetch(`${API_BASE}/health`);
      return response.json();
}

export async function fetchTrips(){
    const response = await fetch(`${API_BASE}/trips`);
    return response.json();
}

export async function postTrip(name){
    return fetch(`${API_BASE}/trips`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ name })
    });
}