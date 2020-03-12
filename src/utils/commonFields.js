// DATABASE ENUMS -------------------------------------------------
// Don't forget to update ENUM TYPES of global.d.ts 
// if you make any change
// ----------------------------------------------------------------

module.exports = {
  USER_TRAVELER_STATUSES: {
    dft: 'pending', active: 'active',
    values: ['pending','active','suspended']
  },
  USER_TRAVELER_RELATIONS: {
    dft: 'self',
    values: ['self','relative','friend','coworker','employee','member','client']
  },
  TRAVELER_AGE_BRACKETS: ['18-21','20s','30s','40s','50s','60s','70s','80+'],
  TRAVELER_GENDERS: ['m','f'],
  ADDRESS_TYPES: {
    dft: 'home',
    values: ['home','office','hotel','conference','stadium']
  },
  REGIONS: ['AF','AN','AS','EU','NA','OC','SA'],
  AIRPORT_TYPES: ['airfield','closed','minor','regional','major'],
  AGGLO_RANKS: ['1','2','3','4'],
  AGGLO_DFT_RANK: '3',
  TRIP_TYPES: ['return','oneway','openjaw','loop','other'],
  BOOKING_STATUSES: ['manual','confirmed','auto','autoconfirmed','gdsconfirm','agentconfirm'],
  VIA_CHANGE_TYPES: ['add','del','chg', 'idm'],
  RIDE_STATUS: {
    dft: 'open', inactive: 'disabled', full: 'full', open: 'open', closed: 'closed',
    values: ['open','closed','full','disabled'],
    searchables: ['open','full'],
    allowJoin: ['open']
  },
  RIDE_TYPES: {dft: 'shareCab', shareCab: 'shareCab',
    values: ['shareCab','cabRide','ownCar','rentalCar','relativeCar'],
    carPools: ['cabRide','ownCar','rentalCar','relativeCar']
  },
  RIDE_WAYS: {dft: 'city', toCity: 'city', toAirport: 'airport', values: ['airport','city']},
  PAY_PREFS: {dft: 'flex', flex: 'flex', values: ['jetaid','cash','flex']},
  SMOKE_PREFS: {dft: 'flex', flex: 'flex', values: ['nosmoke','allowsmoke','flex']},
  PET_PREFS: {dft: 'flex', flex: 'flex', values: ['nopet','allowpet','flex']},
  CURB_PREFS: {dft: 'flex', flex: 'flex', values: ['curbonly','allowparking','allowunderground','flex']},
  RIDER_PREFS: {dft: 'any', values: ['cabOnly','cabOrStaff','cabOrCar','staffOrCar','any']},
  RIDER_STATUS: {dft: 'joined', 
    saved: 'saved', suspend: 'suspend', left: 'left', admin: 'admin', joined: 'joined', applied: 'applied', none: 'none', denied: 'denied',
    values: ['driver','provider','owner','admin','joined','applied','denied','saved','left','suspend','none'], 
    rideUniques: ['driver','provider','owner'], 
    riderUniques: ['driver','provider','owner','admin','joined'],
    exclusions: [], // todo: add denied
    keyRider: ['driver','provider'],
    allowSave: ['left','none'],
    allowApply: ['left','saved','applied','none'],
    allowJoin: ['left','saved','applied','none'],
    allowApprove: ['driver','provider','owner','admin'],
    review: ['driver','provider','owner','admin','joined','applied','saved'],
    isPending: ['applied']
  },
  CONVO_TYPES: { 
    dft: 'ride', ride: 'ride', rideRider: 'applicant', task: 'task', tasker: 'tasker',
    values: ['ride','applicant','task','tasker']},
  MESSAGE_STATUS: {
    dft: 'pending', sent: 'sent', pending: 'pending', seen: 'read',
    values: ['sent','pending','delivered','read']
  },
  TASK_TYPE: {
    dft: 'flightonly',
    values: ['flightonly','flighthome','homeflight','homehome']
  },
  TASK_STATUS: {
    dft: 'open', open: 'open',
    values: ['open','closed','disabled'],
    searchables: ['open']
  },
  HELP_STATUS: {
    dft: 'helpee', helpee: 'helpee', helper: 'helper', backup: 'backup', 
    contacted: 'contacted', applied: 'applied', invited: 'invited',
    /** application pulled by the helper */
    pulled: 'pulled',
    /** admission rescinded by a helpee */
    cancelled: 'cancelled', 
    /** helper's via no longer compatible with the task */
    incompatible: 'incompatible',
    values: ['helper','helpee','backup','applied','invited','pulled','contacted','cancelled','incompatible'],
    travelerUnique: ['helper','helpee','backup'],
    publicReview: ['helper','helpee','backup'],
    privateReview: ['helper','helpee','backup','applied','invited'],
    eligibles: ['helper','backup','applied','invited'],
    taskers: ['helper','backup'],
    revealAddress: ['helper'],
    invitables: ['pulled','contacted','cancelled'],
    searchables: ['pulled','contacted','invited','applied','cancelled'],
    manageables: ['helper','helpee','backup','applied','invited','contacted']
  },
  VIA_BOUND: {
    dft: 'dep', departure: 'dep', arrival: 'arr',
    values: ['dep','arr']
  },
  TASK_ASSEMBLER_TYPE: {
    values: ['ownTask','otherTask','ownProvTask','otherProvTask'],
    dft: 'ownTask',
    provisionals: ['ownProvTask','otherProvTask'],
    restricted: ['otherTask','otherProvTask']
  },
  TASK_QUERY_TYPE: {
    beneficiary: 'prov', member: 'via',
    values: ['prov','via']
  },
  CHANGE_TYPE: {
    values: ['none','minimal','breaking','expanding','restrictive']
  },
  TASK_NOTICE_TYPE: {
    dft: 'new_messages',
    status: 'status_change', 
    rank: 'rank_change',
    messages: 'new_messages',
    values: ['status_change','rank_change','new_messages']
  },
  TASK_NOTICE_SUBTYPE: {
    dft: 'message_tasker',
    messageTasker: 'message_tasker', messageHelpees: 'message_helpees', invalid: 'unknown',
    values: [
      'joined_as_helper','joined_as_backup', 'was_admitted_helper','was_admitted_backup',
      'was_promoted_helper', 'was_demoted_backup','was_expelled','has_left',
      'has_applied','was_invited', 'invite_was_cancelled','has_pulled_application',
      'rank_upgrade','rank_downgrade',
      'now_incompatible',
      'message_tasker','message_helpees',
      'unknown'
    ]
  },
  NOTICE_SIDE: {
    dft: 'both', twoWay: 'both', toMember: 'to_member', toAdmins: 'to_admins',
    memberRead: ['both','to_member'], adminsRead: ['both','to_admins'],
    values: ['both','to_member','to_admins']
  },
  NOTICE_STATUS: {
    dft: 'active',
    active: 'active', inactives: ['complete'],
    values: ['active','complete']
  },
  USER_NOTICE_STATUS: {
    pending: 'pending', read: 'read',
    actives: ['pending','sent'],
    values: ['pending','sent','read']
  }
};