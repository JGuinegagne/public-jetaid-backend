const express = require('express');

const auth = require('../authorization');
const resAttr = require('../../utils/commonResAttr');
const USER_NOTICE_STATUS = require('../../utils/commonFields').USER_NOTICE_STATUS;
const NOTICE_STATUS = require('../../utils/commonFields').NOTICE_STATUS;

/** @type {JetModels} */
const models = require('../../models');
const Op = require('../../models').Sequelize.Op;

const router = express.Router();

// ----------------------------------------------------------------------------------

// ----------------------------------------------------------------------------------
// GET/all retrieves the latest notices
router.get('/all',auth.required, async (req, res, next) => {
  /** @type {string} */
  const userId = req.payload.id;

  try {
    /** @type {JetAllNoticeResponse} */
    const resp = {
      taskNotices: []
    };

    const userNotices = await models.UserTaskNotice.findAll({
      where: {
        [Op.and]: [
          {user_id: userId},
          {status: {[Op.in]: USER_NOTICE_STATUS.actives}}
        ]
      },
      attributes: resAttr.USER_TASK_NOTICE_ATTRIBUTES
    });
    
    /** @type {{[noticeId: string]: JetUserTaskNoticeInstance}} */
    const userNoticeMap = {};
    if(userNotices)
      userNotices.forEach(userNotice => {
        userNoticeMap[userNotice.task_notice_id]=userNotice;
      });

    const allTaskNoticeIds = Object.keys(userNoticeMap);

    if(allTaskNoticeIds.length > 0){
      const taskNotices = await models.TaskNotice.findAll({
        where: {
          [Op.and]: [
            {id: {[Op.in]: allTaskNoticeIds}},
            {status: {[Op.notIn]: NOTICE_STATUS.inactives}},
          ]
        },
        attributes: resAttr.TASK_NOTICE_ATTRIBUTES,
        include: [{
          model: models.User,
          as: 'Notifier',
          attributes: resAttr.PUBLIC_USER_ATTRIBUTES
        }]
      });

      const taskIds = {};
      taskNotices.forEach(n => taskIds[n.task_id] = true);

      /** @type {{[taskId: string]: JetTaskUserInstance}} */
      const taskIdMap = {};
      if(Object.keys(taskIds).length > 0){
        const userTasks = await models.TasksUsers.findAll({
          where: {[Op.and]: [
            {task_id: {[Op.in]: Object.keys(taskIds)}},
            {user_id: userId}
          ]},
          attributes: resAttr.TASK_USER_ATTRIBUTES
        })

        userTasks.forEach(userTask => 
          taskIdMap[userTask.task_id] = userTask
        );
      }

      if(taskNotices && taskNotices.length > 0)
        resp.taskNotices = taskNotices
          .map(n => n.createResponse(userNoticeMap,taskIdMap));
    }

    return res.status(200).send(resp);

  } catch(error){
    next(error);
  }
});


// ----------------------------------------------------------------------------------
// POST/markread retrieves the latest notices
router.post('/markread',auth.required, async (req, res, next) => {
  if(!req.body.taskNotices || !Array.isArray(req.body.taskNotices)){
    return res.status(422).send({
      errors: {taskNotices: 'Body must include a notices field of type array'}
    });
  }

  /** @type {string[]} */
  const taskNoticeReqs = req.body.taskNotices;

  /** @type {string} */
  const userId = req.payload.id;

  if(!taskNoticeReqs.length){
    return res.status(422).send({
      errors: {taskNotices: 'Array was empty'}
    })
  }

  if(!taskNoticeReqs.every(ut =>
      typeof ut === 'string' && ut.toString('hex') === ut
    )){
    return  res.status(422).send({
      errors: {taskNotices: 'All task notices must be "hex" string'}
    })
  }

  try {
    const userTaskNotices = await models.UserTaskNotice.findAll({
      where: {id: {[Op.in]: taskNoticeReqs}},
      attributes: resAttr.USER_TASK_NOTICE_ATTRIBUTES
    });

    if(!userTaskNotices || userTaskNotices.length !== taskNoticeReqs.length){
      return res.status(404).send({
        errors: {taskNotices: 'some notices could not be found.'}
      });
    }

    if(userTaskNotices.some(n => n.user_id !== userId)){
      return res.status(403).send({
        errors: {taskNotices: 'The logged user is not authorized to mark these notices as read'}
      });
    }

    const toUpdateNotices = userTaskNotices
      .filter(n => USER_NOTICE_STATUS.actives.indexOf(n.status) > -1);

    toUpdateNotices.forEach(n => {
      n.status = USER_NOTICE_STATUS.read;
    });

    await Promise.all(toUpdateNotices
      .map(n => n.save({fields: ['status']}))
    );

    // TODO: delete TaskNotice for which all user have 'read'.

    return res.status(200).send({success: 'notices were updated'});

  } catch(error){
    next(error);
  }
});

// ----------------------------------------------------------------------------------

module.exports = router;