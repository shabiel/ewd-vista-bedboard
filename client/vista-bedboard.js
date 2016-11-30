let clientMethods = {};

// Show Wards and Beds. Called from show application
clientMethods.showWards = function(EWD) {
  EWD.send({type: 'wards'}, function(responseObj) {
    var wards = responseObj.message.wards;
    console.log(wards);
    
    wards.forEach(function(ward, index, array) {
      var html = '<div class="main col-md-4"><h2 class="sub-header">';
      html     = html + ward.name + '</h2><div class="table-responsive">';
      html     = html + '<table class="table table-striped"><thead><tr><td>Bed</td>';
      html     = html + '<td>Patient</td><td>Gender</td><td>Admission Date</td>';
      html     = html + '</tr></thead><tbody>';
      
      var beds = ward.beds;
      beds.forEach(function(bed, index, array) {
        html = html + '<tr><td>' + bed.name;
        if (bed.oos) {
          html = html + ' <span class="glyphicon glyphicon-exclamation-sign"';
          html = html + ' aria-hidden="true" title="' + bed.oos + '"></span>';
        }
        html = html + '</td><td>';
        if (bed.patient.name) {
          html = html + bed.patient.name;
        }
        html = html + '</td><td>';
        if (bed.patient.sex) {
          html = html + bed.patient.sex;
        }
        html = html + '</td><td>';
        if (bed.patient.admissionDate) {
          html = html + bed.patient.admissionDate.replace(/@.*/, '');
        }
        html = html + '</td></tr>';
      });
      
      html = html + '</tbody></table></div></div>';
      
      $('#wards').append(html);
    });
    
    $('#wards glyphicon-exclamation-sign').hover()
    
    $('#wards').show();
  });
}

module.exports = clientMethods;
