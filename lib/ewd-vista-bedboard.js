/* Two needed imports */
// let sessions = require('ewd-session');
// let runRPC   = require('ewd-qoper8-vistarpc/lib/proto/runRPC');

/* Set-up module.export.handlers structure */
module.exports          = {};
module.exports.handlers = {};

// Get wards and beds
module.exports.handlers.wards = function(messageObj, session, send, finished) {
  let query  = {
    file: {number: '42'},
    fields: [{number: '.01'}],
    flags: 'PQ',
    index: 'B',
    screen: 'S D0=Y D WIN^DGPMDDCF I \'X'
  };
  let wardsData = this.handlers['ewd-vista'].listDic.call(this, query).records;

  let wards    = [];
  let bedsNode = new this.documentStore.DocumentNode('DG',[405.4]);

  // Iterate over the wards
  wardsData.forEach(function(ward, index, array) {
    /*
    ward: {
      ien: '1',
      name: 'ONCOLOGY'
    }
    */
    ward.beds = [];  
  
    // Iterate over the beds on this ward
    bedsNode.$('W').$(ward.ien).forEachChild(function(bedIen, bedNode) {
      let bedZeroNodeData = bedsNode.$(bedIen).$('0').value;
    
      let bed     = {};
      bed.name    = bedZeroNodeData.split('^')[0];
      bed.oos     = isBedOutOfService.call(this, bedIen);
      bed.patient = {};
    
      // Now find out if the bed is occupied by a patient
      let admissionIndex = new this.documentStore.DocumentNode('DGPM', ['ARM', bedIen]);
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

function isBedOutOfService(bedIen) {
  // Get first OOS inverse date
  let inverseDateNode = new this.documentStore.DocumentNode('DG',[405.4,bedIen,'I','AINV']).firstChild;
  let inverseDate     = inverseDateNode.name;
  
  if (!inverseDate) { return ''; }
  else {
    // Get the corresponding OOS record
    let oosIEN   = inverseDateNode.firstChild.name;
    let zeroNode = new this.documentStore.DocumentNode('DG', [405.4,bedIen,'I',oosIEN,0]).value;
    
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
