const TASK_NOTICE_TYPE = require('../utils/commonFields').TASK_NOTICE_TYPE;
const TASK_NOTICE_SUBTYPE = require('../utils/commonFields').TASK_NOTICE_SUBTYPE;
const NOTICE_SIDE = require('../utils/commonFields').NOTICE_SIDE;


/** @param {JetModels} models */
module.exports = function(models){

  /** @type {JetConvoHandler} */
  const convoHandler = {};

  convoHandler.rideRiderSaver = function(convo, ride, rideRider, userId, msgRequest, errors){
    if(!msgRequest)
      return () => Promise.resolve(convo);
  
    if(convo){
      return () => convo
        .createRideRiderMessage(ride,rideRider,msgRequest,userId,errors)
        .then(msg => {
          if(msg)
            convo.Messages.push(msg);
          return convo;
        });
    }
  
    return () => models.Convo
      .createRideRiderConvo(rideRider)
      .then(_convo => {
        rideRider.convo_id = _convo.id;
        return _convo.createRideRiderMessage(ride,rideRider,msgRequest,userId,errors)
          .then(msg => {
            _convo.Messages = msg ? [msg] : [];
            return _convo;
          });
      });
  };

  convoHandler.taskerSaver = function(convo,task,tasker,userId,msgRequest,errors,toHelpees=false){
    if(!msgRequest)
      return () => Promise.resolve(convo);

    if(convo){
      return () => convo
        .createTaskTaskerMessage(task,tasker,msgRequest,userId,errors)
        .then(msg => {
          if(msg)
            convo.Messages.push(msg);

            setTimeout(() => {
              const adminTravIds = task.getAdminTravelerIds();

              models.handlers.notice.dispatchTaskNotice(
                tasker,
                adminTravIds,
                TASK_NOTICE_TYPE.messages,
                toHelpees
                  ? TASK_NOTICE_SUBTYPE.messageHelpees
                  : TASK_NOTICE_SUBTYPE.messageTasker,
                userId,
                toHelpees
                  ? NOTICE_SIDE.toAdmins
                  : NOTICE_SIDE.toMember
              ).catch(error => models.handlers.notice
                .handleNoticeError('Tasker message',error)
              );
            }); 

          return convo;
        });
    }

    return () => models.Convo
      .createTaskTaskerConvo(tasker)
      .then(_convo => {
        tasker.convo_id = _convo.id;
        return _convo.createTaskTaskerMessage(task,tasker,msgRequest,userId,errors)
          .then(msg => {
            setTimeout(() => {
              const adminTravIds = task.getAdminTravelerIds();

              models.handlers.notice.dispatchTaskNotice(
                tasker,
                adminTravIds,
                TASK_NOTICE_TYPE.messages,
              toHelpees
                ? TASK_NOTICE_SUBTYPE.messageHelpees
                : TASK_NOTICE_SUBTYPE.messageTasker,
              userId,
              toHelpees
                ? NOTICE_SIDE.toAdmins
                : NOTICE_SIDE.toMember
              ).catch(error => models.handlers.notice
                .handleNoticeError('Tasker message',error)
              );
            });

            _convo.Messages = msg ? [msg] : [];
            return _convo;
          });
      });
  };

  return convoHandler;
};