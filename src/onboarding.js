export const presentations={complete:'Estación + gateway',station:'Solo estación',gateway:'Solo gateway'};
export const displayId=device=>device.friendly_code||device.serial||device.node_label;
export const stationOwner=(station,data)=>data.kits.find(k=>k.id===(station.kit_id||data.gateways.find(g=>g.id===station.gateway_id)?.kit_id))?.owner_id||null;
export const pendingStation=station=>!station.gateway_id||station.bed_height===null||station.bed_height===undefined;
export const pendingForUser=(data,userId)=>data.stations.filter(s=>stationOwner(s,data)===userId&&pendingStation(s));
export function availableGateways(station,data){
 const owner=stationOwner(station,data);
 return data.gateways.filter(g=>g.kit_id===station.kit_id||(owner&&data.kits.find(k=>k.id===g.kit_id)?.owner_id===owner));
}
