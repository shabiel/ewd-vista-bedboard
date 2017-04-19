if( !process.argv[2] || !process.argv[3] )
{
  console.log('Usage: ');
  console.log('node rpc-test.js ac vc');
  process.exit(-1);
}

var Minterface = require('nodem');
var DocumentStore = require('ewd-qoper8-gtm/node_modules/ewd-document-store');
var runRPC = require('ewd-qoper8-vistarpc/lib/proto/runRPC');
var sessions = require('ewd-session');

this.db = new Minterface.Gtm();
this.db.open();
this.documentStore = new DocumentStore(this.db);

console.log(this.documentStore.db.version());

sessions.addTo(this.documentStore);
this.db.symbolTable = sessions.symbolTable(this.db);
var session = sessions.create('bbApp');

runRPC.call(this, {rpcName: 'XUS SIGNON SETUP'}, session);

// Insert credentials
var accessCode = process.argv[2];
var verifyCode = process.argv[3];
params = {
  rpcName: 'XUS AV CODE',
  rpcArgs: [{
    type: 'LITERAL',
    value: accessCode + ';' + verifyCode
  }]
};

response = runRPC.call(this, params, session);
console.log('login response: ' + JSON.stringify(response));
//
// Set division if more than one exists
var divisions = runRPC.call(this, {rpcName: 'XUS DIVISION GET'}, session).value;

divisions.splice(0,1); // Remove array length element
// Keep only IENs
divisions.forEach(function(element, index, array) {
  array[index] = element.split('^')[0];
});

if (divisions.length > 0) {
  params = {
    rpcName: 'XUS DIVISION SET',
    rpcArgs: [{
      type: 'LITERAL',
      value: '`' + divisions[0]
    }]
  };

  var result = runRPC.call(this, params, session).value == 1 ? true : false;

  console.log('Division set: ' + result);
}

result = this.db.function({ function: 'LIST^ewdVistAFileman', arguments: [42,"","@;.01","PQ","","","","B","S D0=Y D WIN^DGPMDDCF I 'X",""] });
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

  var eachward  = {};
  eachward.name = wardName;
  eachward.beds = [];

  // Iterate over the beds on this ward
  bedsNode.$('W').$(wardIEN).forEachChild(function(bedIEN, bedNode) {
    // console.log();
    // console.log("Bed IEN: " + bedIEN);
    // console.log("Out of service: " + isBedOutOfService.call(this, bedIEN));
    // console.log();

    var bedZeroNodeData = bedsNode.$(bedIEN).$('0').value;

    var bed     = {};
    bed.name    = bedZeroNodeData.split('^')[0];
    bed.patient = {};

    // Now find out if the bed is occupied by a patient
    var admissionIndex = new this.documentStore.DocumentNode('DGPM', ['ARM', bedIEN]);
    if (admissionIndex.exists) {
      var admissionIEN         = admissionIndex.name;
      var admissionData        = new this.documentStore.DocumentNode('DGPM', [admissionIEN, 0]).value;

      var admissionDateFileman = admissionData.split('^')[0];
      // TODO Replace with standard formate date
      // var admissionDate = this.db.function({
      //   function: 'FMTE^XLFDT',
      //   arguments: [admissionDateFileman]
      // });
      bed.patient.admissionDate = admissionDateFileman;

      var dfn          = admissionData.split('^')[2];
      var patientData  = new this.documentStore.DocumentNode('DPT', [dfn, 0]).value;

      bed.patient.name = patientData.split('^')[0];
      bed.patient.sex  = patientData.split('^')[1];
    }

    eachward.beds.push(bed);
  });
  wards.push(eachward);
});

// console.log();
// console.log();
// console.log("Wards:");
// console.log()
// console.log(JSON.stringify(wards, null, 1));

/////////
this.db.close();
/////////

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

  if (!inverseDate) { return false; }
  else {
    // Get the corresponding OOS record
    var oosIEN   = inverseDateNode.firstChild.name;
    var zeroNode = new this.documentStore.DocumentNode('DG', [405.4,bedIEN,"I",oosIEN,0]).value;

    if (!zeroNode) { return false; }
    else {
      // Get the details
      var zeroNodeArray = zeroNode.split('^');

      var oosDate          = zeroNodeArray[0];
      var reactivationDate = zeroNodeArray[3];
      var todaysDate       = this.documentStore.db.function({ function: 'NOW^XLFDT' });

      if (todaysDate < oosDate || todaysDate > reactivationDate) {
        return false;
      }
      else {
        var reasonIEN = zeroNodeArray[1];
        var reason    = this.documentStore.db.function({ function: 'GET1^DIQ', arguments: ['405.5', reasonIEN, '.01'] }).result;
        var comment   = zeroNodeArray[2];

        return reason + " / " + comment;
      }
    }
  }
}
