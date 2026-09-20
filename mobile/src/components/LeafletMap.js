import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { WebView } from "react-native-webview";

// Keyless map: Leaflet + OpenStreetMap inside a WebView (same look as the website, no Google/Apple
// map SDK keys needed). React Native pushes state in with injectJavaScript; the page posts back
// taps and pin drags.
const GLYPH = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 11 9-8 9 8M5 10v10h14V10"/></svg>',
  store: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9 5.5 4h13L20 9M4 9v11h16V9M4 9a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0A2.7 2.7 0 0 0 20 9"/></svg>',
  draft: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="3"/></svg>',
  rider: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="17" r="3"/><circle cx="18" cy="17" r="3"/><path d="M6 17h5l3-7h3l1 7M9 6h3l2 4"/></svg>',
};

const HTML = `<!doctype html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<style>
html,body,#m{height:100%;margin:0;background:#ECF3FF}
.mk{background:transparent;border:0}
.pin{width:40px;height:40px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:grid;place-items:center;color:#fff;border:3px solid #fff;box-shadow:0 6px 14px rgba(0,0,0,.3)}
.pin svg{width:18px;height:18px;transform:rotate(45deg)}
.pin.home{background:#2F6BFF}.pin.store{background:#f59e0b}.pin.draft{background:#ef4444}
.rider{width:44px;height:44px;border-radius:50%;background:#0b1b3a;color:#fff;display:grid;place-items:center;border:3px solid #fff;box-shadow:0 6px 16px rgba(0,0,0,.35)}
.rider svg{width:22px;height:22px}
.leaflet-marker-icon.smooth{transition:transform 1s linear}
</style></head><body><div id="m"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
var GLYPH=${JSON.stringify(GLYPH)};
var map=L.map('m',{zoomControl:false,attributionControl:true}).setView([20.59,78.96],5);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap'}).addTo(map);
var mk={},routeLine=null,circle=null,fitted=null;
function post(o){window.ReactNativeWebView.postMessage(JSON.stringify(o))}
map.on('click',function(e){post({type:'click',lat:e.latlng.lat,lng:e.latlng.lng})});
function icon(kind){
  if(kind==='rider')return L.divIcon({className:'mk',html:'<div class="rider">'+GLYPH.rider+'</div>',iconSize:[44,44],iconAnchor:[22,22]});
  return L.divIcon({className:'mk',html:'<div class="pin '+kind+'">'+(GLYPH[kind]||GLYPH.home)+'</div>',iconSize:[40,40],iconAnchor:[20,48]});
}
window.setState=function(s){
  var seen={};
  (s.markers||[]).forEach(function(m){
    seen[m.id]=1;
    if(mk[m.id]){mk[m.id].setLatLng([m.lat,m.lng]);return}
    var x=L.marker([m.lat,m.lng],{icon:icon(m.kind),draggable:!!m.draggable}).addTo(map);
    if(m.kind==='rider'&&x.getElement())x.getElement().classList.add('smooth');
    if(m.draggable)x.on('dragend',function(){var p=x.getLatLng();post({type:'drag',id:m.id,lat:p.lat,lng:p.lng})});
    mk[m.id]=x;
  });
  Object.keys(mk).forEach(function(id){if(!seen[id]){mk[id].remove();delete mk[id]}});
  if(routeLine){routeLine.remove();routeLine=null}
  if(s.route&&s.route.length>1)routeLine=L.polyline(s.route,{color:'#2F6BFF',weight:5,opacity:.85,dashArray:'1 10',lineCap:'round'}).addTo(map);
  if(circle){circle.remove();circle=null}
  if(s.circle)circle=L.circle([s.circle.lat,s.circle.lng],{radius:s.circle.radiusKm*1000,color:'#12C2B5',weight:1.5,fillColor:'#12C2B5',fillOpacity:.07,interactive:false}).addTo(map);
  if(s.markers&&s.markers.length&&fitted!==s.fitKey){
    fitted=s.fitKey;
    var pts=s.markers.map(function(m){return[m.lat,m.lng]});
    if(s.route&&s.route.length)pts=pts.concat(s.route);
    if(pts.length===1)map.setView(pts[0],15);else map.fitBounds(L.latLngBounds(pts),{padding:[48,48],maxZoom:16});
  }
};
post({type:'ready'});
</script></body></html>`;

export default function LeafletMap({ markers = [], route = null, circle = null, fitKey = "", onMapClick, onMarkerDragEnd, style }) {
  const ref = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!ready) return;
    const state = JSON.stringify({ markers, route, circle, fitKey });
    ref.current?.injectJavaScript(`window.setState(${state});true;`);
  }, [ready, markers, route, circle, fitKey]);

  const onMessage = (e) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg.type === "ready") setReady(true);
      else if (msg.type === "click") onMapClick?.({ lat: msg.lat, lng: msg.lng });
      else if (msg.type === "drag") onMarkerDragEnd?.(msg.id, { lat: msg.lat, lng: msg.lng });
    } catch {}
  };

  return (
    <View style={[{ overflow: "hidden", borderRadius: 24, backgroundColor: "#ECF3FF" }, style]}>
      <WebView
        ref={ref}
        source={{ html: HTML, baseUrl: "https://laundrypoint.app" }}
        originWhitelist={["*"]}
        javaScriptEnabled
        domStorageEnabled
        onMessage={onMessage}
        scrollEnabled={false}
        nestedScrollEnabled
        overScrollMode="never"
        setSupportMultipleWindows={false}
        style={{ flex: 1, backgroundColor: "transparent" }}
      />
    </View>
  );
}
