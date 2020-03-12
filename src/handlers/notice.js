const NOTICE_SIDE = require('../utils/commonFields').NOTICE_SIDE;
const TASK_NOTICE_SUBTYPE = require('../utils/commonFields').TASK_NOTICE_SUBTYPE;
const resAttr = require('../utils/commonResAttr');

/** @param {JetModels} models */
module.exports = function(models){
  const Op = models.sequelize.Op;

  /** @type {JetNoticeHandler} */
  const noticeHandler = {};

  noticeHandler.dispatchTaskNotice = function(
    member, 
    helpeeIds,
    type, 
    subType, 
    notifierUserId, 
    side = NOTICE_SIDE.twoWay,
    travUsersMap = null
  ) {
    if(!type || !subType || subType === TASK_NOTICE_SUBTYPE.invalid || !side)
      return Promise.reject(`invalid type: ${type}, subType: ${subType} or side: ${side}`);

    if(!helpeeIds || !helpeeIds.length)
    return Promise.reject(`invalid helpee ids info`);

    if(!notifierUserId || notifierUserId.toString('hex') !== notifierUserId)
      notifierUserId = null;

    const noticeTravIds = [];

    if(NOTICE_SIDE.adminsRead.includes(side)){
      noticeTravIds.push(...helpeeIds);
    }
    
    if(NOTICE_SIDE.memberRead.includes(side)){
      noticeTravIds.push(member.traveler_id)
    }

    return Promise.all([
      models.TaskNotice.findOne({
        where: {
          [Op.and]: [
            {task_via_traveler_id: member.id},
            {type: type},
            {side: side}
          ]
        },
        attributes: resAttr.TASK_NOTICE_ATTRIBUTES
      }),

      travUsersMap
        ? Promise.resolve(travUsersMap)
        : models.UsersTravelers.createTravsUsersMap(noticeTravIds)

    ]).then(([notice,travUsersMap]) => {
      const adminUserIds = {};
      const taskerUserIds = {};

      if(travUsersMap){
        noticeTravIds.forEach(travId => {
          const travUsers = travUsersMap[travId];

          if(helpeeIds.indexOf(travId) > -1)
            travUsers.forEach(travUser => 
              adminUserIds[travUser.user_id] = true
            );
          else
            travUsers.forEach(travUser => 
              taskerUserIds[travUser.user_id] = true
            );

        });
      }

      const noticeUserIds = Object.keys(adminUserIds)
        .concat(taskerUserIds);

      if(!noticeUserIds.length)
        return Promise.reject('DispatchTaskNotice: no users were found');

      const userIdsArg = {
        admins: Object.keys(adminUserIds),
        taskers: Object.keys(taskerUserIds)
      };


      if(notice){
        notice.sub_type = subType;
        notice.user_id = notifierUserId;
        return notice
          .save({fields: ['sub_type','user_id']})
          .then(() => models.UserTaskNotice
            .createOrUpdateUsersTaskNotices(notice.id,userIdsArg)
          ).then(() => notice);

      } else {
        const newNotice = models.TaskNotice
          .buildFromRequest(member,type,subType,notifierUserId,side);

        return newNotice
          .save()
          .then(notice => models.UserTaskNotice
            .createUsersTaskNotices(notice.id,userIdsArg)
          ).then(() => newNotice);
      }
    })
  };


  noticeHandler.dispatchTaskNotices = function(requests,userId) {
    if(!requests || !requests.length)
      return Promise.resolve(true);

    if(!userId || userId.toString('hex') !== userId)
      userId = null;

    const allTravIds = {};
    requests.forEach(req => {
      if(NOTICE_SIDE.memberRead.includes(req.side))
        allTravIds[req.member.traveler_id] = true;

      if(NOTICE_SIDE.adminsRead.includes(req.side))
        req.helpeeIds.forEach(travId => 
          allTravIds[travId] = true
        );
    })

    if(Object.keys(allTravIds).length === 0)
      return Promise.reject('DispatchTaskNotices: traveler ids was empty');

    return models.UsersTravelers
      .createTravsUsersMap(Object.keys(allTravIds))
      .then(travUsersMap => Promise.all(
        requests.map(r => noticeHandler.dispatchTaskNotice(
          r.member,
          r.helpeeIds,
          r.type,
          r.subType,
          userId,
          r.side,
          travUsersMap
        ))
      ))
  }


  noticeHandler.handleNoticeError = function(desc, error){
    console.log(`Error in ${typeof desc === 'string' ? desc.toLowerCase() : desc}`);
    if(error)
      console.log(error);
  }

  return noticeHandler;
};
