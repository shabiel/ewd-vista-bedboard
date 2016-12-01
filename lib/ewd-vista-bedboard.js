/* Two needed imports */
// var sessions = require('ewd-session');
// var runRPC   = require('ewd-qoper8-vistarpc/lib/proto/runRPC');

/* Set-up module.export.handlers structure */
module.exports          = {};
module.exports.handlers = {};

// Get wards and beds
module.exports.handlers.wards = function(messageObj, session, send, finished) {
  var result = this.db.function({ function: "LIST^ewdVistAFileman",
                              arguments: [42,"","@;.01","PQ","","","","B","S D0=Y D WIN^DGPMDDCF I 'X",""] });
  console.log(result);

  var wardsNode = new this.documentStore.DocumentNode('TMP', ["DILIST", process.pid]);
  var wardsData = convertDILISTToArray.call(this, wardsNode);
  wardsData     = wardsData['IEN^.01'];

  var wards = [];

  var bedsNode = new this.documentStore.DocumentNode('DG',[405.4]);

  // Iterate over the wards
  wardsData.forEach(function(ward, index, array) {
    var wardIEN  = ward.split('^')[0];
    var wardName = ward.split('^')[1];
  
    var ward  = {};
    ward.name = wardName;
    ward.beds = [];  
  
    // Iterate over the beds on this ward
    bedsNode.$('W').$(wardIEN).forEachChild(function(bedIEN, bedNode) {
      var bedZeroNodeData = bedsNode.$(bedIEN).$('0').value;
    
      var bed     = {};
      bed.name    = bedZeroNodeData.split('^')[0];
      bed.oos     = isBedOutOfService.call(this, bedIEN);
      bed.patient = {};
    
      // Now find out if the bed is occupied by a patient
      var admissionIndex = new this.documentStore.DocumentNode('DGPM', ['ARM', bedIEN]);
      if (admissionIndex.exists) {
        var admissionIEN         = admissionIndex.name;
        var admissionData        = new this.documentStore.DocumentNode('DGPM', [admissionIEN, 0]).value;
      
        var admissionDate = admissionData.split('^')[0];
        admissionDate = this.documentStore.db.function({
          function: 'FMTE^XLFDT',
          arguments: [admissionDate]
        });
        bed.patient.admissionDate = admissionDate.result;
      
        var dfn          = admissionData.split('^')[2];
        var patientData  = new this.documentStore.DocumentNode('DPT', [dfn, 0]).value;
      
        bed.patient.name = patientData.split('^')[0];
        bed.patient.sex  = patientData.split('^')[1];
      }
    
      ward.beds.push(bed)
    });
    wards.push(ward);
  });
  
  finished({wards: wards});
}

function convertDILISTToArray(node)
{
    /*
    ^TMP("DILIST",1314,0)="3236^*^0^"
    ^TMP("DILIST",1314,0,"MAP")="IEN^IX(1)"
    ^TMP("DILIST",1314,1,0)="1578^ACKQAUD1"
    ^TMP("DILIST",1314,2,0)="1579^ACKQAUD2"
    */

  var db = this.documentStore.db;

  var arrayKey = node.$('0').$("MAP").value;
  var entriesArray = [];
  node.forEachChild({ range: { from: '1' , to: ' ' } } , function(name, ChildNode)
  {
      entriesArray.push(ChildNode.$('0').value);
  }
  );
  var result = {};
  result[arrayKey] = entriesArray;
  return result;
}

function isBedOutOfService(bedIEN) {
  // Get first OOS inverse date
  var inverseDateNode = new this.documentStore.DocumentNode('DG',[405.4,bedIEN,"I","AINV"]).firstChild;
  var inverseDate     = inverseDateNode.name;
  
  if (!inverseDate) { return ''; }
  else {
    // Get the corresponding OOS record
    var oosIEN   = inverseDateNode.firstChild.name;
    var zeroNode = new this.documentStore.DocumentNode('DG', [405.4,bedIEN,"I",oosIEN,0]).value;
    
    if (!zeroNode) { return ''; }
    else {
      // Get the details
      var zeroNodeArray = zeroNode.split('^');
      
      var oosDate          = zeroNodeArray[0];
      var reactivationDate = zeroNodeArray[3];
      var todaysDate       = this.documentStore.db.function({ function: 'NOW^XLFDT' });
      
      if (todaysDate < oosDate || todaysDate > reactivationDate) {
        return '';
      }
      else {
        var reasonIEN = zeroNodeArray[1];
        var reason    = this.documentStore.db.function({
                          function: 'GET1^DIQ',
                          arguments: ['405.5', reasonIEN, '.01']
                        }).result;
        var comment   = zeroNodeArray[2];
        
        return reason + " / " + comment;
      }
    }
  }
}


