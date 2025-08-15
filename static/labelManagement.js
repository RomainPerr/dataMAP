


function buildLabelTree(labels, $root, roots) {
  function createNode(label, data) {
    var $li = $('<li></li>');
    var $span = $('<span class="node-cpe"></span>').text(label).css({color: data.color});
    $li.append('<i class="icon-tag"></i> ').append($span);
    if (data.children && data.children.length > 0) {
      var $ul = $('<ul></ul>');
      data.children.forEach(function(child) {
        if (labels[child]) {
          $ul.append(createNode(child, labels[child]));
        } else {
          // fallback for orphan child
          $ul.append('<li><i class="icon-tag"></i> <span class="node-cpe">' + child + '</span></li>');
        }
      });
      $li.append($ul);
    }
    return $li;
  }

  Object.keys(labels).forEach(function(label) {
    // Only add root nodes (not children of any other label)
    var isChild = false;
    if (roots && roots.indexOf(label) === -1) {
      isChild = true;
    }
    if (!isChild) {
      $root.append($('<ul></ul>').append(createNode(label, labels[label])));
    }
  });

  // Enable drag and drop after building the tree
  if (window.DragAndDrop && typeof window.DragAndDrop.enable === "function") {
    window.DragAndDrop.enable($root);
  }
}


// Ensure DragAndDrop is defined and available after page load
$(document).ready(function() {
  window.DragAndDrop = (function (DragAndDrop) {

      function shouldAcceptDrop(item) {

          var $target = $(this).closest("li");
          var $item = item.closest("li");

          if ($.contains($item[0], $target[0])) {
              // can't drop on one of your children!
              return false;
          }

          // Prevent dropping if label name is the same as any ancestor
          var itemLabel = $item.find(".node-cpe, .node-facility").first().text().trim();
          var $ancestor = $target;
          var ancestorLabels = [];
          while ($ancestor.length && !$ancestor.is("body")) {
            var ancestorLabel = $ancestor.find(".node-cpe, .node-facility").first().text().trim();
            ancestorLabels.push(ancestorLabel);
            if (ancestorLabel === itemLabel) {
              // can't drop on any ancestor with the same name
              return false;
            }
            $ancestor = $ancestor.parent().closest("li");
          }

          // Prevent dropping if label name is the same as any child of the target node
          var $children = $target.closest("li").children("ul").children("li");
          var hasSameLabelChild = $children.children(".node-cpe, .node-facility").filter(function() {
            return $(this).text().trim() === itemLabel;
          }).length > 0;
          if (hasSameLabelChild) {
            // can't drop if a child has the same name
            return false;
          }

          // Prevent if any descendant of the dragged item has the same label as any new ancestor
          var $descendants = $item.find(".node-cpe, .node-facility");
          var conflict = false;
          $descendants.each(function() {
            var descLabel = $(this).text().trim();
            if (ancestorLabels.indexOf(descLabel) !== -1) {
              conflict = true;
              return false; // break loop
            }
          });
          if (conflict) {
            // can't drop if a descendant has same label as one of the new ancestors
            return false;
          }

          return true;
      }

      function itemOver(event, ui) {
      }

      function itemOut(event, ui) {
      }

      function itemDropped(event, ui) {

          var $target = $(this).closest("li");
          var $item = ui.draggable.closest("li");
          
          var $srcUL = $item.parent("ul");
          var $dstUL = $target.children("ul").first();

          // destination may not have a UL yet
          if ($dstUL.length == 0) {
              $dstUL = $("<ul></ul>");
              $target.append($dstUL);
          }

          $item.slideUp(50, function() {

            $dstUL.append($item);
    
            if ($srcUL.children("li").length == 0) {
                $srcUL.remove();
            }
            
            $item.slideDown(50, function() {
              $item.css('display', '');
            });

          });

      }

      DragAndDrop.enable = function (selector) {

          $(selector).find(".node-cpe").draggable({
              helper: "clone"
          });

          $(selector).find(".node-cpe, .node-facility").droppable({
              activeClass: "active",
              hoverClass: "hover",
              accept: shouldAcceptDrop,
              over: itemOver,
              out: itemOut,
              drop: itemDropped,
              greedy: true,
              tolerance: "pointer"
          });

      };

      return DragAndDrop;

  })(window.DragAndDrop || {});
});

(function ($) {
  
  $.fn.beginEditing = function(whenDone) {
    if (!whenDone) { whenDone = function() { }; }

    var $node = this;
    var $editor = $("<input type='text' style='width:auto; min-width: 25px;'></input>");
    var currentValue = $node.text();

    function commit() {
      var newValue = $editor.val().trim();
      if (newValue === "") {
        // Prevent empty label, restore previous value
        cancel();
        return;
      }

      // Prevent same name as any ancestor
      var $li = $node.closest("li");
      var $ancestor = $li.parent().closest("li");
      while ($ancestor.length && !$ancestor.is("body")) {
        var ancestorLabel = $ancestor.find(".node-cpe, .node-facility").first().text().trim();
        if (ancestorLabel === newValue) {
          alert("L'étiquette sélectionnée fait partie d'un groupe dont le nom est celui que vous essayez d'utiliser.");
          cancel();
          return;
        }
        $ancestor = $ancestor.parent().closest("li");
      }

      // Prevent same name as any descendant
      var hasSameDescendant = $li.find(".node-cpe, .node-facility").filter(function() {
        return $(this).text().trim() === newValue;
      }).length > 0;
      if (hasSameDescendant) {
        alert("Ce nom d'étiquette fait déjà partie du groupe descendant de l'étiquette sélectionnée.");
        cancel();
        return;
      }

      // Prevent same name as any sibling
      var $siblings = $li.siblings("li").children(".node-cpe, .node-facility");
      var hasSameSibling = $siblings.filter(function() {
        return $(this).text().trim() === newValue;
      }).length > 0;
      if (hasSameSibling) {
        alert("Ce nom d'étiquette fait déjà partie du groupe de l'étiquette sélectionnée.");
        cancel();
        return;
      }
      $editor.remove();
      $node.text(newValue);
      // If there are other labels with the same name, match all their characteristics (CSS styles, classes, etc.)
      var $allLabels = $('#dragRoot *[class*=node]').filter(function() {
        return $(this).text() === newValue && this !== $node[0];
      });
      if ($allLabels.length > 0) {
        var ref = $allLabels.first();
        // Copy all classes except for the editing state
        $node.attr('class', ref.attr('class'));
        // Copy all inline styles
        $node.attr('style', ref.attr('style'));
        // Optionally, copy data attributes if needed
        $.each(ref.data(), function(key, value) {
          $node.data(key, value);
        });
      }
      whenDone($node);
    }

    function cancel() {
      $editor.remove();
      $node.text(currentValue);
      whenDone($node);
    }

    $editor.val(currentValue);
    $editor.blur(function() { commit(); });
    $editor.keydown(function(event) {
      if (event.which == 27) { cancel(); return false; }
      else if (event.which == 13) { commit(); return false; }
    });

    $node.empty();
    $node.append($editor);
    $editor.focus();
    $editor.select();
  };
  
})(jQuery);

$(document).ready(function () {
  DragAndDrop.enable("#dragRoot");
  
  $(document).on("dblclick", "#dragRoot *[class*=node]", function() {
    if (!$(this).hasClass("non-editable")) {
      $(this).beginEditing();
    }
  });

  $(document).on("click", "#addLabelBtn", function() {
    addLabel();
  });

  $(document).on("click", "#addTitleBtn", function() {
    addTitle();
  });

  $(document).on("contextmenu", "#dragRoot *[class*=node]", function(e) {
    e.preventDefault();
    var $label = $(this);
    $('#labelName').val($label.text());
    $('#labelConfigModal').data('labelElement', $label);
    $('#labelConfigModal').modal('show');
  });

  // Attach submit handler to the form instead of waiting for click
  $(document).on("submit", "#labelConfigForm", function(e) {
    e.preventDefault();
    saveLabelOptions();
  });
  $(document).on("click", "#labelConfigModal .btn-primary", function() {
    $('#labelConfigModal').on('show.bs.modal', function() {
      resetColor();
    });
  });
  $(document).on("click", "#labelConfigModal .btn-default", function(){
    $('#labelConfigForm')[0].reset();
    $('#labelConfigModal').css('display', 'none');
  });
  $(document).on("click", "#saveLabelBtn", function() {
    saveLabelParameters();
  });
  $(document).on("click", "#deleteLabel", function() {
    var $label = $('#labelConfigModal').data('labelElement');
    $label.closest('li').remove();
    $('#labelConfigModal').modal('hide');
  });
  $(document).on("click", "#duplicateLabel", function() {
    duplicateLabel()
  });

});

// Append a new label (not a category) under the last category
function addLabel(){

  var $ul = $('#uncategorized-labels').children('ul');
  if ($ul.length === 0) {
    $ul = $('<ul></ul>');
    $('#uncategorized-labels').append($ul);
  }
  $ul.append('<li><i class="icon-tag"></i> <span class="node-cpe">Nouvelle étiquette</span></li>');  DragAndDrop.enable($('#dragRoot li:last-child'));
}

function addTitle(){
  var $lastCategory = $('#dragRoot .node-facility:last-child');
  var $ul = $lastCategory.children('ul');
  if ($ul.length === 0) {
    $ul = $('<ul></ul>');
    $lastCategory.append($ul);
  }
  $ul.append('<li><i class="icon-tag"></i> <span class="node-cpe">Nouveau titre</span></li>');  DragAndDrop.enable($('#dragRoot li:last-child'));
}


function saveLabelOptions(){
  var $label = $('#labelConfigModal').data('labelElement');
  // get all labels with same name as the current label
  var sameLabel=[];
  var labelName = $label.text();
  var newLabelName = $('#labelName').val();
  var $allLabels = $('#dragRoot *[class*=node]').filter(function() {
    return $(this).text() === newLabelName;
  });

  $(".label-error-message").remove(); // Remove previous errors

  if (newLabelName.trim() === "") {
    $('#labelName').addClass('is-invalid');
    if ($('#labelName').next('.label-error-message').length === 0) {
      $('#labelName').after('<div class="label-error-message text-danger" style="font-size:0.9em;">Le nom de l\'étiquette ne peut pas être vide.</div>');
    }
    return false;
  } else {
    $('#labelName').removeClass('is-invalid');
    $('#labelName').next('.label-error-message').remove();
  }

  // Prevent same name as any ancestor
  var $li = $label.closest("li");
  var $ancestor = $li.parent().closest("li");
  while ($ancestor.length && !$ancestor.is("body")) {
    var ancestorLabel = $ancestor.find(".node-cpe, .node-facility").first().text().trim();
    if (ancestorLabel === newLabelName) {
      $('#labelName').addClass('is-invalid');
      if ($('#labelName').next('.label-error-message').length === 0) {
        $('#labelName').after('<div class="label-error-message text-danger" style="font-size:0.9em;">L\'étiquette sélectionnée fait partie d\'un groupe dont le nom est celui que vous essayez d\'utiliser.</div>');
      }
      return false;
    }
    $ancestor = $ancestor.parent().closest("li");
  }

  // Prevent same name as any descendant (excluding the label itself)
  var hasSameDescendant = $li.find(".node-cpe, .node-facility").filter(function() {
    return $(this).text().trim() === newLabelName && this !== $label[0];
  }).length > 0;
  if (hasSameDescendant) {
    $('#labelName').addClass('is-invalid');
    if ($('#labelName').next('.label-error-message').length === 0) {
      $('#labelName').after('<div class="label-error-message text-danger" style="font-size:0.9em;">Ce nom d\'étiquette fait déjà partie du groupe descendant de l\'étiquette sélectionnée.</div>');
    }
    return false;
  }

  // Prevent same name as any sibling
  var $siblings = $li.siblings("li").children(".node-cpe, .node-facility");
  var hasSameSibling = $siblings.filter(function() {
    return $(this).text().trim() === newLabelName;
  }).length > 0;
  if (hasSameSibling) {
    $('#labelName').addClass('is-invalid');
    if ($('#labelName').next('.label-error-message').length === 0) {
      $('#labelName').after('<div class="label-error-message text-danger" style="font-size:0.9em;">Ce nom d\'étiquette fait déjà partie du groupe de l\'étiquette sélectionnée.</div>');
    }
    return false;
  }
  $('#labelName').removeClass('is-invalid');
  $('#labelName').next('.label-error-message').remove();


  $allLabels.each(function() {
    sameLabel.push($(this));
  });
  sameLabel.push($label); 

  if ((sameLabel.length > 1) && (labelName.trim() !== newLabelName.trim())) {
    if (!window.confirm("All labels with the same name will be modified. Do you want to continue?")) {
      $('#labelConfigModal').modal('hide');
      return false;
    }
  }
  
  for (var i = 0; i < sameLabel.length; i++) {
    sameLabel[i].text($('#labelName').val());
    sameLabel[i].css('color', $('#labelColor').val());
  }
  $('#labelConfigModal').modal('hide');
}

function resetColor(){
  var $label = $('#labelConfigModal').data('labelElement');
  var currentColor = $label.css('color');
  // Convert rgb to hex if needed
  function rgb2hex(rgb) {
    if (!rgb) return '#000000';
    var result = rgb.match(/\d+/g);
    if (!result) return '#000000';
    return "#" + result.slice(0, 3).map(function(x) {
      var hex = parseInt(x).toString(16);
      return hex.length == 1 ? "0" + hex : hex;
    }).join('');
  }
  $('#labelColor').val(rgb2hex(currentColor));
}

function saveLabelParameters() {
  var dic = {racine_non_classifiées: [], non_classifiées: {}, racine_classifiées: [], classifiées: {}};
  $('#uncategorized-labels .node-cpe').each(function() {
    var $label = $(this);
    dic.non_classifiées[$label.text()] = {
      color: $label.css('color')
    };
  });
  console.log(dic);
  
  $('#categorized-labels .node-cpe').each(function() {
    var $label = $(this);
    var children = [];
    // Only get direct children (first level)
    $label.closest('li').children('ul').children('li').children('.node-cpe').each(function() {
      children.push($(this).text());
    });
    dic.classifiées[$label.text()] = {
      children: children,
      color: $label.css('color')
    };
  });

  dic.racine_classifiées = $('#categorized-labels > ul > li').map(function() {
    return $(this).children('.node-cpe').text();
  }).get();

  dic.racine_non_classifiées = $('#uncategorized-labels > ul > li').map(function() {
    return $(this).children('.node-cpe').text();
  }).get();

  fetch('/save-labels', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(dic)
  }).then(function(response) {
    if (response.ok) {
      console.log("Labels saved successfully.");
    } else {
      console.error("Error saving labels.");
    }
  });
}

function duplicateLabel() {
  var $label = $('#labelConfigModal').data('labelElement');
  var $newLabel = $('<li></li>').append($label.clone());
  DragAndDrop.enable($newLabel);
  $label.closest('li').after($newLabel);
  $('#labelConfigModal').modal('hide');
}