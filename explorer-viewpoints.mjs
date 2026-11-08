export const REFERENCE_VIEWS=[
 {name:'Alpine lake',seed:'HORIZON-01',lon:171.2338,lat:-39.0583,height:2838,yaw:1.57,pitch:-.1,flying:true,speed:30,expect:'Check lake-edge material wedges and water alignment'},
 {name:'Mountain corridor',seed:'HORIZON-01',lon:171.067,lat:-38.837,height:3020,yaw:0,pitch:-.1,flying:true,speed:30,expect:'Check for artificial walls and floating detail'},
 {name:'Coastal forest',seed:'HORIZON-01',lon:-51.5197,lat:43.5931,height:89,yaw:1.57,pitch:0,flying:true,speed:100,expect:'Compare distant canopy coverage'},
 {name:'Dry grassland',seed:'HORIZON-01',lon:-32.8166,lat:35.7151,height:94,yaw:0,pitch:-.1,flying:true,speed:30,expect:'Compare ground cover and hillside bands'},
 {name:'Tropical hillside',seed:'HORIZON-01',lon:-.9595,lat:10.2858,height:151,yaw:0,pitch:-.1,flying:true,speed:30,expect:'Check nearby versus distant vegetation'},
 {"name":"River bend","seed":"HORIZON-01","lon":-89.8789390459188,"lat":-49.35146053390242,"height":125.60288330581378,"yaw":1.017373394340951,"pitch":-0.1,"flying":true,"speed":30,"expect":"Compare surface, object grounding and streaming through return travel"},
 {"name":"Desert","seed":"HORIZON-01","lon":42.29474035080539,"lat":43.94531206856015,"height":695.7264713162075,"yaw":0,"pitch":-0.1,"flying":true,"speed":30,"expect":"Compare surface, object grounding and streaming through return travel"},
 {"name":"Woodland","seed":"HORIZON-01","lon":-73.25109072796643,"lat":36.44531216943691,"height":140.64624593022896,"yaw":0,"pitch":-0.1,"flying":true,"speed":30,"expect":"Compare surface, object grounding and streaming through return travel"},
 {"name":"Glacier","seed":"HORIZON-01","lon":-111.6796875,"lat":-59.6484375,"height":398.49017333984375,"yaw":0,"pitch":-0.1,"flying":true,"speed":30,"expect":"Compare surface, object grounding and streaming through return travel"}
].map(v=>({...v,generatorVersion:'horizon-geography-0.9.11',textures:true,shadows:true,geometryOnly:false}));
export function validateView(v){return !!v&&typeof v.seed==='string'&&v.seed.length>0&&v.seed.length<=100&&['lon','lat','height','yaw','pitch','speed'].every(k=>Number.isFinite(v[k]))&&Math.abs(v.lat)<=90&&Math.abs(v.lon)<=180&&v.height>=-12000&&v.height<=200000&&v.speed>0&&v.speed<=2000&&Math.abs(v.pitch)<=1.4&&typeof v.flying==='boolean';}
export function encodeView(v){if(!validateView(v))throw Error('Invalid viewpoint');return JSON.stringify(v);}
export function decodeView(text){try{const v=JSON.parse(text);return validateView(v)?v:null;}catch{return null;}}
