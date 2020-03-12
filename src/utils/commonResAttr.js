// STANDARD RESPONSE ATTRIBUTES -----------------------------------
// To be used in Model.find({attributes: []})
// ----------------------------------------------------------------

const USER_TRAVELER_ATTRIBUTES = ['id','user_id','traveler_id','nickname','relation','ordinal','status'];
const PUBLIC_TRAVELER_ATTRIBUTES = ['public_name','age_bracket','gender','pic'];
const LINK_TRAVELER_ATTRIBUTES = [
  'id','email','first_name','middle_name','last_name','dob',
  'public_name','age_bracket','gender','pic'
];

const USER_MAP_ATTRIBUTES = ['id','public_name','email'];
const PROFILE_USER_ATTRIBUTES = ['id','public_name','email'];
const PUBLIC_USER_ATTRIBUTES = ['public_name'];

const ADDRESS_ATTRIBUTES = ['street_name','street_number','latitude','longitude','locator','provider'];
const ADDRESS_EXTENDED_ATTRIBUTES = ADDRESS_ATTRIBUTES.concat(['id','city_id','state_id','country_id']);
const ADDRESS_INFO_ATTRIBUTES = [
  'building_name','apartment_identifier','floor_identifier','postcode','building_description','access_description'
];
const CITY_RESPONSE_ATTRIBUTES = ['name'];
const STATE_RESPONSE_ATTRIBUTES = ['name','code'];
const COUNTRY_RESPONSE_ATTRIBUTES = ['code','name','flag_emoji'];

const USER_ADDRESS_ATTRIBUTES = ['id','user_id','address_id','alias','type'];
const TRAVELER_ADDRESS_ATTRIBUTES = ['id','traveler_id','address_id','alias','type'];

const PHONE_ATTRIBUTES = ['dial','local_voice','intl_voice','local_text','intl_text','local_data','intl_data','landline'];
const COUNTRY_PHONE_ATTRIBUTES = ['code','name','flag_emoji','phone'];
const USER_PHONE_ATTRIBUTES = ['id','user_id','phone_id','alias'];
const TRAVELER_PHONE_ATTRIBUTES = ['id','traveler_id','phone_id','alias'];

const EMAIL_ATTRIBUTES = ['email','verified'];
const USER_EMAIL_ATTRIBUTES = ['id','email_id','user_id'];
const TRAVELER_EMAIL_ATTRIBUTES = ['id','email_id','traveler_id']; 

const AIRLINE_MAP_ATTRIBUTES = ['id','iata','icao','name','country_id'];
const AIRPORT_MAP_ATTRIBUTES = ['id','name'];
const TERMINAL_MAP_ATTRIBUTES = ['id','code','name','domestic_time','international_time','operating','airport_id'];

const AIRLINE_RESPONSE_ATTRIBUTES = ['iata','name','icao'];
const AIRPORT_RESPONSE_ATTRIBUTES = ['id','name'];
const TERMINAL_RESPONSE_ATTRIBUTES = ['code','name'];
const AGGLO_RESPONSE_ATTRIBUTES = ['name'];
const HOOD_RESPONSE_ATTRIBUTES = ['name'];

const TRIP_ATTRIBUTES = ['type'];
const TRIP_USER_ATTRIBUTES = ['id','user_id','trip_id','alias'];
const VIA_ATTRIBUTES = ['dep_date','arr_date','dep_time','arr_time','ordinal'];
const VIA_UPDATE_ATTRIBUTES = VIA_ATTRIBUTES.concat([
  'id','trip_id','airline_id','flight_id','layover_id',
  'dep_airport_id','arr_airport_id','dep_terminal_id','arr_terminal_id'
]);
const VIA_TRAVELER_ATTRIBUTES = ['id','traveler_id','via_id','booking_status','volunteer'];

const AGGLO_MAP_ATTRIBUTES = ['id','name'];
const HOOD_MAP_ATTRIBUTES = ['id','name','agglo_id','suburb'];
const HOOD_GEOMAP_ATTRIBUTES = ['id','name','latitude','longitude','agglo_id','suburb'];
const AIRPORT_GEOMAP_ATTRIBUTES = ['id','name','latitude','longitude'];
const AGGLO_GEOMAP_ATTRIBUTES = ['id','name','latitude','longitude','rank','population'];
const FLIGHT_MAP_ATTRIBUTES = ['id','code','airline_id','dep_time','arr_time','dep_airport_id','arr_airport_id'];

const RIDE_SUMMARY_ATTRIBUTES = ['type','status'];
const RIDE_ACTIVATE_ATTRIBUTES = ['id','type','status'];
const RIDE_PUBLIC_ATTRIBUTES = [
  'date','start_time','status','type','toward','public',
  'seat_count','luggage_count','baby_seat_count','sport_equip_count',
  'pay_method','smoke_policy','pet_policy','curb_policy',
  'airport_id','agglo_id'
];

const RIDER_PRIVATE_ATTRIBUTES = ['date','dep_time','pref','toward','seat_count','luggage_count','baby_seat_count','sport_equip_count'];
const RIDER_UPDATE_ATTRIBUTES = RIDER_PRIVATE_ATTRIBUTES.concat(['id','airport_id','terminal_id','neighborhood_id','creator_id','via_id']);
const RIDER_SEARCH_ATTRIBUTES = ['date','dep_time','toward','airport_id'];
const RIDER_FILTER_ATTRIBUTES = RIDER_PRIVATE_ATTRIBUTES.concat(['id','via_id']);
const RIDER_FROMRIDE_ATTRIBUTES = RIDER_PRIVATE_ATTRIBUTES.filter(attr => !['pref'].includes(attr)).concat(['neighborhood_id','terminal_id']);
const RIDER_RESETRIDE_ATTRIBUTES = RIDER_PRIVATE_ATTRIBUTES.concat(['neighborhood_id','terminal_id']);
const RIDER_VIADELETE_ATTRIBUTES = ['id','address_id','via_id'];

const RIDER_USER_ATTRIBUTES = ['id','rider_id','user_id'];
const RIDER_TRAVELER_ATTRIBUTES = ['id','rider_id','traveler_id'];

const RIDER_VIA_ATTRIBUTES = ['ordinal','trip_id'];

const JOINED_RIDE_ATTRIBUTES = ['id','status','joined_at'];
const RIDE_RIDER_ATTRIBUTES = ['id','rider_id','ride_id','status','joined_at','request_id','counter_id','convo_id'];
const RIDE_RIDER_REQUEST_ATTRIBUTES = [
  'id','ride_rider_id','date','start_time',
  'seat_count','luggage_count','baby_seat_count','sport_equip_count',
  'pay_method','smoke_policy','pet_policy','curb_policy',
  'close_ride',
  'neighborhood_ordinal','terminal_ordinal'
];

const RIDE_CITYSTOP_ATTRIBUTES = ['id','ordinal','ride_rider_id','neighborhood_id'];
const RIDE_TERMINALSTOP_ATTRIBUTES = ['id','ordinal','ride_rider_id','terminal_id'];

const RIDEREQUEST_CITYSTOPDROP_ATTRIBUTES = ['request_id','city_stop_id'];
const RIDEREQUEST_TERMINALSTOPDROP_ATTRIBUTES = ['request_id','terminal_stop_id'];

const RIDER_CONVO_ATTRIBUTES = ['id','created_at','ride_rider_id','ride_id'];
const MESSAGE_ATTRIBUTES= ['id','content','posted_at','created_at'];
const MESSAGE_EXTENDED_ATTRIBUTES = ['id','content','posted_at','created_at','author_id'];

const TASK_BASE_ATTRIBUTES = ['type','status','dep_neighborhood_id','arr_neighborhood_id','dep_address_id','arr_address_id'];
const TASK_PROVISIONAL_ATTRIBUTES = TASK_BASE_ATTRIBUTES.concat(['earliest_date','latest_date','earliest_time','latest_time']);
const TASK_ATTRIBUTES = TASK_BASE_ATTRIBUTES.concat(['start_date','end_date','start_time','end_time','dep_airport_id','arr_airport_id','via_id']);
const TASK_FULL_ATTRIBUTES = TASK_BASE_ATTRIBUTES.concat(...TASK_PROVISIONAL_ATTRIBUTES).concat(...TASK_ATTRIBUTES);
const TASK_SWITCH_ATTRIBUTES = [
  'earliest_date','latest_date','earliest_time','latest_time',
  'start_date','end_date','start_time','end_time',
  'dep_airport_id','arr_airport_id','via_id'];
const TASK_USER_ATTRIBUTES = ['id','user_id','task_id'];
const TASK_TRAVELER_ATTRIBUTES = ['id','traveler_id','task_id','created_at'];
const TASK_AIRPORT_ATTRIBUTES = ['airport_id','task_id','bound','neighborhood_id'];
const TASK_FLIGHT_ATTRIBUTES = ['flight_id','task_id'];
const TASK_VIA_TRAVELER_ATTRIBUTES = ['id','traveler_id','task_id','via_id','via_traveler_id','convo_id','status','rank','created_at'];

const TASK_CONVO_ATTRIBUTES = ['id','created_at','task_via_traveler_id','task_id'];

const TASK_NOTICE_ATTRIBUTES = ['id','task_via_traveler_id','task_id','type','sub_type','status','side','updated_at'];
const USER_TASK_NOTICE_ATTRIBUTES = ['id','task_notice_id','user_id','status','task_admin'];


module.exports = {
  USER_TRAVELER_ATTRIBUTES,
  PUBLIC_TRAVELER_ATTRIBUTES,
  LINK_TRAVELER_ATTRIBUTES,

  USER_MAP_ATTRIBUTES,
  PROFILE_USER_ATTRIBUTES,
  PUBLIC_USER_ATTRIBUTES,

  ADDRESS_ATTRIBUTES,
  ADDRESS_EXTENDED_ATTRIBUTES,
  ADDRESS_INFO_ATTRIBUTES,
  CITY_RESPONSE_ATTRIBUTES,
  STATE_RESPONSE_ATTRIBUTES,
  COUNTRY_RESPONSE_ATTRIBUTES,

  USER_ADDRESS_ATTRIBUTES,
  TRAVELER_ADDRESS_ATTRIBUTES,

  PHONE_ATTRIBUTES,
  COUNTRY_PHONE_ATTRIBUTES,
  USER_PHONE_ATTRIBUTES,
  TRAVELER_PHONE_ATTRIBUTES,

  EMAIL_ATTRIBUTES,
  USER_EMAIL_ATTRIBUTES,
  TRAVELER_EMAIL_ATTRIBUTES,

  AIRLINE_MAP_ATTRIBUTES,
  AIRPORT_MAP_ATTRIBUTES,
  TERMINAL_MAP_ATTRIBUTES,

  AIRLINE_RESPONSE_ATTRIBUTES,
  AIRPORT_RESPONSE_ATTRIBUTES,
  TERMINAL_RESPONSE_ATTRIBUTES,
  AGGLO_RESPONSE_ATTRIBUTES,
  HOOD_RESPONSE_ATTRIBUTES,

  TRIP_ATTRIBUTES,
  TRIP_USER_ATTRIBUTES,
  VIA_ATTRIBUTES,
  VIA_UPDATE_ATTRIBUTES,
  VIA_TRAVELER_ATTRIBUTES,

  AGGLO_MAP_ATTRIBUTES,
  HOOD_MAP_ATTRIBUTES,
  HOOD_GEOMAP_ATTRIBUTES,
  AIRPORT_GEOMAP_ATTRIBUTES,
  AGGLO_GEOMAP_ATTRIBUTES,
  FLIGHT_MAP_ATTRIBUTES,

  RIDE_SUMMARY_ATTRIBUTES,
  RIDE_ACTIVATE_ATTRIBUTES,
  RIDE_PUBLIC_ATTRIBUTES,

  RIDER_PRIVATE_ATTRIBUTES,
  RIDER_UPDATE_ATTRIBUTES,
  RIDER_SEARCH_ATTRIBUTES,
  RIDER_FILTER_ATTRIBUTES,
  RIDER_FROMRIDE_ATTRIBUTES,
  RIDER_RESETRIDE_ATTRIBUTES,
  RIDER_VIADELETE_ATTRIBUTES,

  RIDER_USER_ATTRIBUTES,
  RIDER_TRAVELER_ATTRIBUTES,
  RIDER_VIA_ATTRIBUTES,

  JOINED_RIDE_ATTRIBUTES,
  RIDE_RIDER_ATTRIBUTES,
  RIDE_RIDER_REQUEST_ATTRIBUTES,

  RIDE_CITYSTOP_ATTRIBUTES,
  RIDE_TERMINALSTOP_ATTRIBUTES,
  RIDEREQUEST_CITYSTOPDROP_ATTRIBUTES,
  RIDEREQUEST_TERMINALSTOPDROP_ATTRIBUTES,

  RIDER_CONVO_ATTRIBUTES,
  MESSAGE_ATTRIBUTES,
  MESSAGE_EXTENDED_ATTRIBUTES,

  TASK_PROVISIONAL_ATTRIBUTES,
  TASK_ATTRIBUTES,
  TASK_FULL_ATTRIBUTES,
  TASK_SWITCH_ATTRIBUTES,
  TASK_TRAVELER_ATTRIBUTES,
  TASK_USER_ATTRIBUTES,
  TASK_AIRPORT_ATTRIBUTES,
  TASK_FLIGHT_ATTRIBUTES,
  TASK_VIA_TRAVELER_ATTRIBUTES,

  TASK_CONVO_ATTRIBUTES,

  TASK_NOTICE_ATTRIBUTES,
  USER_TASK_NOTICE_ATTRIBUTES
};