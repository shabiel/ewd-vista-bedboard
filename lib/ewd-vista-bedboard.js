/* Two needed imports */
// let sessions = require('ewd-session');
// let runRPC   = require('ewd-qoper8-vistarpc/lib/proto/runRPC');

/* Set-up module.export.handlers structure */
module.exports          = {};
module.exports.handlers = {};

// Get wards and beds
module.exports.handlers.wards = function(messageObj, session, send, finished) {
  let result = this.db.function({ function: 'LIST^ewdVistAFileman',
                              arguments: [42,'','@;.01','PQ','','','','B','S D0=Y D WIN^DGPMDDCF I \'X',''] });
  // console.log(result);

  let wardsNode = new this.documentStore.DocumentNode('TMP', ['DILIST', process.pid]);
  let wardsData = convertDILISTToArray.call(this, wardsNode);
  wardsData     = wardsData['IEN^.01'];

  let wards = [];

  let bedsNode = new this.documentStore.DocumentNode('DG',[405.4]);

  // Iterate over the wards
  wardsData.forEach(function(ward, index, array) {
    let wardIEN  = ward.split('^')[0];
    let wardName = ward.split('^')[1];
  
    ward      = {};
    ward.name = wardName;
    ward.beds = [];  
  
    // Iterate over the beds on this ward
    bedsNode.$('W').$(wardIEN).forEachChild(function(bedIEN, bedNode) {
      let bedZeroNodeData = bedsNode.$(bedIEN).$('0').value;
    
      let bed     = {};
      bed.name    = bedZeroNodeData.split('^')[0];
      bed.oos     = isBedOutOfService.call(this, bedIEN);
      bed.patient = {};
    
      // Now find out if the bed is occupied by a patient
      let admissionIndex = new this.documentStore.DocumentNode('DGPM', ['ARM', bedIEN]);
      if (admissionIndex.exists) {
        let admissionIEN         = admissionIndex.name;
        let admissionData        = new this.documentStore.DocumentNode('DGPM', [admissionIEN, 0]).value;
      
        let admissionDate = admissionData.split('^')[0];
        admissionDate = this.documentStore.db.function({
          function: 'FMTE^XLFDT',
          arguments: [admissionDate]
        });
        bed.patient.admissionDate = admissionDate.result;
      
        let dfn          = admissionData.split('^')[2];
        let patientData  = new this.documentStore.DocumentNode('DPT', [dfn, 0]).value;
      
        bed.patient.name = patientData.split('^')[0];
        bed.patient.sex  = patientData.split('^')[1];
      }
    
      ward.beds.push(bed);
    });
    wards.push(ward);
  });
  
  finished({wards: wards});
};

function convertDILISTToArray(node)
{
    /*
    ^TMP('DILIST',1314,0)='3236^*^0^'
    ^TMP('DILIST',1314,0,'MAP')='IEN^IX(1)'
    ^TMP('DILIST',1314,1,0)='1578^ACKQAUD1'
    ^TMP('DILIST',1314,2,0)='1579^ACKQAUD2'
    */

  let db = this.documentStore.db;

  let arrayKey = node.$('0').$('MAP').value;
  let entriesArray = [];
  node.forEachChild({ range: { from: '1' , to: ' ' } } , function(name, ChildNode)
  {
    entriesArray.push(ChildNode.$('0').value);
  }
  );
  let result = {};
  result[arrayKey] = entriesArray;
  return result;
}

function isBedOutOfService(bedIEN) {
  // Get first OOS inverse date
  let inverseDateNode = new this.documentStore.DocumentNode('DG',[405.4,bedIEN,'I','AINV']).firstChild;
  let inverseDate     = inverseDateNode.name;
  
  if (!inverseDate) { return ''; }
  else {
    // Get the corresponding OOS record
    let oosIEN   = inverseDateNode.firstChild.name;
    let zeroNode = new this.documentStore.DocumentNode('DG', [405.4,bedIEN,'I',oosIEN,0]).value;
    
    if (!zeroNode) { return ''; }
    else {
      // Get the details
      let zeroNodeArray = zeroNode.split('^');
      
      let oosDate          = zeroNodeArray[0];
      let reactivationDate = zeroNodeArray[3];
      let todaysDate       = this.documentStore.db.function({ function: 'NOW^XLFDT' });
      
      if (todaysDate < oosDate || todaysDate > reactivationDate) {
        return '';
      }
      else {
        let reasonIEN = zeroNodeArray[1];
        let reason    = this.documentStore.db.function({
          function: 'GET1^DIQ',
          arguments: ['405.5', reasonIEN, '.01']
        }).result;
        let comment   = zeroNodeArray[2];
        
        return reason + ' / ' + comment;
      }
    }
  }
}


