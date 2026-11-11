# NearRegion

Small web app that finds the **closest AWS region** to a given location.

## Run

Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 5173
```

Then visit http://localhost:5173

## How it works

1. Enter a city/address, or `lat, lng`, or use **Use my location**
2. Place names are geocoded with [OpenStreetMap Nominatim](https://nominatim.openstreetmap.org/)
3. Distances use the haversine (great-circle) formula to each region metro

## Notes

- Distances are geographic, not network latency
- Region coordinates are approximate metro centers for public commercial AWS regions
