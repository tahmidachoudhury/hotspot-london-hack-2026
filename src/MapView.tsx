import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';
import { useEffect, useRef } from 'react';
import type { Video } from './types';
import { ACCENT } from './VideoCard';

const LONDON_CENTER: L.LatLngTuple = [51.5074, -0.1278];
// Same bbox as scripts/geocode.js: lng -0.489..0.236, lat 51.28..51.686.
const LONDON_BOUNDS = L.latLngBounds([51.28, -0.489], [51.686, 0.236]);
// Selection radius is constant on screen, so the real-world radius shrinks as
// the user zooms in — zoomed out you grab a neighbourhood, zoomed in a street.
const PICK_RADIUS_PX = 42;
const PICK_RADIUS_MIN_M = 100; // ≈ the geocode jitter, so a tight click still catches a cluster
const PICK_RADIUS_MAX_M = 2500;

export interface MapViewProps {
  videos: Video[]; // only rows with coordinates
  savedIds: Record<string, boolean>;
  onSelect: (nearby: Video[]) => void;
}

export default function MapView({ videos, savedIds, onSelect }: MapViewProps) {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const heatRef = useRef<L.Layer | null>(null);
  const pinsRef = useRef<L.LayerGroup | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  // Latest props for the click handler without re-binding it.
  const videosRef = useRef(videos);
  const onSelectRef = useRef(onSelect);
  videosRef.current = videos;
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!divRef.current || mapRef.current) return;
    const map = L.map(divRef.current, {
      center: LONDON_CENTER,
      zoom: 12,
      maxBounds: LONDON_BOUNDS,
      maxBoundsViscosity: 1, // hard edge — no rubber-banding past the bbox
    });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);
    // Floor the zoom at "viewport fits inside the bbox", so zooming out can
    // never reveal anything beyond it; depends on container size, hence resize.
    const clampZoom = () => map.setMinZoom(map.getBoundsZoom(LONDON_BOUNDS, true));
    clampZoom();
    map.on('resize', clampZoom);
    map.on('click', (e: L.LeafletMouseEvent) => {
      const origin = map.latLngToContainerPoint(e.latlng);
      const edge = map.containerPointToLatLng(origin.add([PICK_RADIUS_PX, 0]));
      const radius = Math.min(PICK_RADIUS_MAX_M, Math.max(PICK_RADIUS_MIN_M, map.distance(e.latlng, edge)));
      const nearby = videosRef.current.filter(
        (v) => map.distance(e.latlng, [v.latitude!, v.longitude!]) <= radius,
      );
      circleRef.current?.remove();
      circleRef.current = L.circle(e.latlng, {
        radius,
        color: ACCENT,
        weight: 1.5,
        fillColor: ACCENT,
        fillOpacity: 0.08,
      }).addTo(map);
      onSelectRef.current(nearby);
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Heat layer + saved pins follow the (category-filtered) videos.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    heatRef.current?.remove();
    const points = videos.map((v) => [v.latitude!, v.longitude!, 0.85] as [number, number, number]);
    heatRef.current = L.heatLayer(points, { radius: 26, blur: 18, maxZoom: 15, minOpacity: 0.35 }).addTo(map);

    pinsRef.current?.remove();
    const pins = L.layerGroup();
    for (const v of videos) {
      if (!savedIds[v.id]) continue;
      const marker = L.marker([v.latitude!, v.longitude!], {
        icon: L.divIcon({ className: 'hs-pin', html: '♥', iconSize: [28, 28], iconAnchor: [14, 14] }),
      });
      // Build the popup as DOM nodes — titles come from external platforms.
      const popup = document.createElement('div');
      const title = document.createElement('div');
      title.textContent = v.title ?? v.location_tag ?? 'Saved spot';
      title.style.cssText = 'font-weight:600;max-width:200px;margin-bottom:4px';
      const link = document.createElement('a');
      link.href = v.original_url;
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = 'Open ↗';
      popup.append(title, link);
      marker.bindPopup(popup);
      pins.addLayer(marker);
    }
    pins.addTo(map);
    pinsRef.current = pins;
  }, [videos, savedIds]);

  return (
    <div
      ref={divRef}
      style={{
        height: 'clamp(380px, 55vh, 560px)',
        borderRadius: '18px',
        overflow: 'hidden',
        position: 'relative',
        zIndex: 0, // cap Leaflet's internal pane z-indexes below the sticky nav
        boxShadow: '0 6px 18px -10px rgba(20,10,20,.4)',
      }}
    />
  );
}
