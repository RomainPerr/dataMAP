// LOADING OF THE PAGE

window.onload = function() {
  var $root = $('#categorized-labels');
  buildLabelTree(labels["liste des étiquettes"]["classifiées"], $root, labels["racines"]["racine_classifiées"], true);
  $root = $('#uncategorized-labels');
  buildLabelTree(labels["liste des étiquettes"]["non_classifiées"], $root, labels["racines"]["racine_non_classifiées"], false);
};

//TREE CONSTRUCTION AND FUNCTIONNALITIES IMPLEMENTATION

function initToggle($li) {
  var $ul = $li.children('ul');
  if ($ul.children('li').length > 0 ) {
    if ($li.children('.toggle-children').length > 0) {
      $li.children('.toggle-children').remove();
    }
    var isVisible = $ul.css('display') !== 'none';
    var $toggle = $('<span class="toggle-children" style="cursor:pointer; margin-right:4px;" title="Afficher/masquer les descendants">' + (isVisible ? '[–]' : '[+]') + '</span>');
    $li.prepend($toggle);

    $toggle.on('click', function(e) {
      e.stopPropagation();
      $ul.toggle();
      $toggle.text($ul.is(':visible') ? '[–]' : '[+]');
      $li.children('.node-cpe, .node-facility').first().attr('data-descendants-hidden', !$ul.is(':visible'));
    });
  }
}

function toggleHide($li){
  var $ul = $li.children('ul');
  var $toggle = $li.find('.toggle-children');
  var $span = $li.children('.node-cpe, .node-facility').first();

  $ul.hide();
  $toggle.text('[+]');
  $span.attr('data-descendants-hidden', true);
}

function buildLabelTree(labels, $root, roots, isClassified) {
  function createNode(label, data) {
    var $li = $('<li></li>');
    var $span = $('<span class="node-cpe"></span>').text(label).css('color', data.color).data('attachedDataframes', data.attachedDataframes);
    if (data.font && data.font.trim() !== "") {
      $span.addClass(data.font);
    }
    // var style = {
    //   "color": data.style.color
    // };
    // var $span = $('<span class="node-cpe"></span>').text(label).css(style).data('attachedDataframes', data.attachedDataframes);
    $li.append('<i class="icon-tag"></i> ').append($span);

    // Add show/hide toggle if there are children
    if (data.children && data.children.length > 0 && isClassified) {
      

      var $ul = $('<ul></ul>');
      data.children.forEach(function(child) {
        if (labels[child]) {
          $ul.append(createNode(child, labels[child]));
        } else {
          // fallback for orphan child
          $ul.append('<li><i class="icon-tag"></i> <span class="node-cpe">' + child + '</span></li>');
        }
        
      $li.append($ul);
      initToggle($li);
      });

      if (data.isDescendantsHidden === "true") {
        toggleHide($li);
      }
    }
    return $li;
  }

  $root.append($('<ul></ul>'));
  Object.keys(labels).forEach(function(label) {
    // Only add root nodes (not children of any other label)
    var isChild = false;
    if (roots && roots.indexOf(label) === -1) {
      isChild = true;
    }
    if (!isChild) {
      $root.children("ul").append(createNode(label, labels[label]));
    }
  });

  // Enable drag and drop after building the tree
  if (window.DragAndDrop && typeof window.DragAndDrop.enable === "function") {
    window.DragAndDrop.enable($root);
  }
}






//HELPER FUNCTIONS

function addChildToLi($li, $child) {
  var $ul = $li.children('ul');
  if ($ul.length === 0) {
    $ul = $('<ul></ul>');
    $li.append($ul);
  }
  $ul.append($child);
  initToggle($li);
  return $ul;
}

function addChild($li, $child) {
  addChildToLi($li, $child);
  $('#dragRoot *[class*=node]').filter(function() {
      return $(this).text() === $li.find(".node-cpe, .node-facility").first().text() && this !== $li.find(".node-cpe, .node-facility").first()[0];
  }).each(function() {
    var $labelLi = $(this).closest("li");
    var $clonedItem = cloneItem($child);
    addChildToLi($labelLi, $clonedItem);
  });
}

function removeChild($li, $child) {
  var $ul = $li.children('ul');
  if ($ul.length > 0) {
    $ul.children('li').filter(function() {
      return $(this).find(".node-cpe, .node-facility").first().text() === $child.find(".node-cpe, .node-facility").first().text();
    }).each(function() {
      $(this).remove();
    });
  }

  // Also remove from all other same-named labels in the tree
  $('#dragRoot *[class*=node]').filter(function() {
    return $(this).text() === $li.find(".node-cpe, .node-facility").first().text() && this !== $li.find(".node-cpe, .node-facility").first()[0];
  }).each(function() {
    var $labelLi = $(this).closest("li");
    var $labelUl = $labelLi.children('ul');
    if ($labelUl.length > 0) {
      $labelUl.children('li').filter(function() {
        return $(this).find(".node-cpe, .node-facility").first().text() === $child.find(".node-cpe, .node-facility").first().text();
      }).each(function() {
        $(this).remove();
      });
      if ($labelUl.children("li").length == 0) {
        $labelUl.remove();
      }
    }
  });
  if ($ul.children("li").length == 0) {
      $ul.remove();
  }
}

function cloneItem($item) {
  var $clonedItem = $item.clone(false, false).show();
  DragAndDrop.enable($clonedItem);
  initToggle($clonedItem);
  return $clonedItem;
}

function isAncestorWithSameName($node, name) {
  var $li = $node.closest("li");
  var $ancestor = $li.parents("li").first();
  while ($ancestor.length) {
    var ancestorLabel = $ancestor.find(".node-cpe, .node-facility").first().text().trim();
    if (ancestorLabel === name) {
      return true;
    }
    $ancestor = $ancestor.parents("li").first();
  }
  return false;
}

function hasDescendantSameName($node, name) {
  var $li = $node.closest("li");
  var $descendants = $li.find(".node-cpe, .node-facility").not($node);
  return $descendants.filter(function() {
    return $(this).text().trim() === name;
  }).length > 0;
}

function hasSiblingSameName($node, name) {
  var $li = $node.closest("li");
  var $siblings = $li.siblings("li").children(".node-cpe, .node-facility");
  return $siblings.filter(function() {
    return $(this).text().trim() === name && this !== $node[0];
  }).length > 0;
}

// Helper: Copy classes and styles from reference node
function copyClassesAndStyles($target, $source) {
  $target.closest("span").attr('class', $source.attr('class'));
  $target.closest("span").attr('style', $source.attr('style'));
}

// Helper: Copy data attributes from reference node
function copyDataAttributes($target, $source) {
  $.each($source.data(), function(key, value) {
    $target.data(key, value);
  });
}

// Helper: Clone and sync children UL from reference LI
function syncChildrenUl($target, $ref) {
  var $refLi = $ref.closest('li');
  var $targetLi = $target.closest('li');
  var $refUl = $refLi.children('ul').first();
  if ($refUl.length) {
    $targetLi.children('ul').remove();
    var $clonedUl = $refUl.clone(false, false);
    DragAndDrop.enable($clonedUl);
    $targetLi.append($clonedUl);
    // Add toggle if not present
    initToggle($targetLi);
  }
}

function copyLabel($target, $ref) {
  copyClassesAndStyles($target, $ref);
  copyDataAttributes($target, $ref);
  syncChildrenUl($target, $ref);
}

// DRAG AND DROP BASE LOGIC
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

          $item.slideUp(50, function() {
            addChild($target, $item);

            // Remove all children named as the moved label from all parents named as the original parent, except the moved item itself
            var srcParentLabelName = $srcUL.parent().closest('li').children('.node-cpe, .node-facility').first().text().trim();
            var movedLabelName = $item.find('.node-cpe, .node-facility').first().text().trim();
            removeChild($srcUL.parent().closest('li'), $item);
            
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




// NAME EDITING LOGIC

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
      var $ancestor = $node.parent().closest("li");
      if (isAncestorWithSameName($node, newValue)) {
        alert("L'étiquette sélectionnée fait partie d'un groupe dont le nom est celui que vous essayez d'utiliser.");
        cancel();
        return;
      }
      

      // Prevent same name as any descendant
      if (hasDescendantSameName($node, newValue)) {
        alert("Ce nom d'étiquette fait déjà partie du groupe descendant de l'étiquette sélectionnée.");
        cancel();
        return;
      }

      // Prevent same name as any sibling
      if (hasSiblingSameName($node, newValue)) {
        alert("Ce nom d'étiquette fait déjà partie du groupe de l'étiquette sélectionnée.");
        cancel();
        return;
      }
      
      $editor.remove();
      $node.text(newValue);


      

      // If there are other labels with the same name, match all their characteristics
      var $allLabels = $('#dragRoot *[class*=node]').filter(function() {
        return $(this).text() === newValue && this !== $node[0];
      });
      if ($allLabels.length > 0) {
        var ref = $allLabels.first();
        copyLabel($node, ref);
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


//LISTENERS

$(document).ready(function () {
  DragAndDrop.enable("#dragRoot");
  
  $(document).on("dblclick", "#dragRoot *[class*=node]", function(e) {
    if (!$(this).hasClass("non-editable")) {
      onHoverNode(e, false);
      $(this).beginEditing();
    }
  });

  $(document).on("click", "#addLabelBtn", function() {
    addLabel();
  });



  $(document).on("contextmenu", "#dragRoot *[class*=node]", function(e) {
    e.preventDefault();
    var $label = $(this);
    $('#labelName').val($label.text());
    $('#labelConfigModal').data('labelElement', $label);
    var attached = $label.data('attachedDataframes') || [];
    // Set the checkboxes for attached dataframes
    $('#labelAttachedDataframes input[type="checkbox"]').each(function() {
      var val = $(this).val();
      $(this).prop('checked', attached.indexOf(val) !== -1);
    });
    //Set the header level input to the current label's header level
    $('#labelHeaderLevel').val($label.data('headerLevel') || 0);
    // Set the color input to the current label color, converting from rgb to hex if needed
    function rgb2hex(rgb) {
      if (!rgb) return '#000000';
      var result = rgb.match(/\d+/g);
      if (!result) return '#000000';
      return "#" + result.slice(0, 3).map(function(x) {
        var hex = parseInt(x).toString(16);
        return hex.length == 1 ? "0" + hex : hex;
      }).join('');
    }
    $('#labelColor').val(rgb2hex($label.css('color')));
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
    saveLabelAttribution();
  });
  $(document).on("click", "#deleteLabel", function() {
    var $label = $('#labelConfigModal').data('labelElement');
    $label.closest('li').remove();
    $('#labelConfigModal').modal('hide');
  });
  $(document).on("click", "#duplicateLabel", function() {
    duplicateLabel()
  });
  $(document).on("mouseenter", "#dragRoot .node-cpe", function(e) {
    onHoverNode(e, true);
  });
  $(document).on("mouseleave", "#dragRoot .node-cpe", function(e) {
    onHoverNode(e, false);
  });
  $(document).on("click", "#labelAttributionButton", function() {
    showLabelAttributionModal();
  });
  $(document).on("submit", "#labelAttributionForm", function(e) {
    e.preventDefault();
    saveLabelAttribution();
  });

});

// HANDLE LISTENERS

function showLabelAttributionModal(){
  // For each dataframe column, check the box if the label is in the attachedLabels of a label's parameters (all happens locally until general save outside the modal)
    var attributionDic = {};
    $('#dragRoot *[class*=node]').each(function() {
      var $label = $(this);
      var labelName = $label.text();
      var attached = $label.data('attachedDataframes') || [];
      attached.forEach(function(dataframe) {
        if (!attributionDic[dataframe]) {
          attributionDic[dataframe] = [];
        }
        attributionDic[dataframe].push(labelName);
      });
    });
    
    // Get all unique label names
    var allLabels = [];
    $('#categorized-labels ul *[class*=node], #uncategorized-labels ul *[class*=node]').each(function() {
      var labelName = $(this).text();
      if (allLabels.indexOf(labelName) === -1) {
      allLabels.push(labelName);
      }
    });
    allLabels.sort();
    console.log(allLabels);

    // Clear all columns before appending new checkboxes
    $('#labelAttributionForm .form-group div[style*="overflow-y: auto"]').each(function() {
      $(this).empty();
    });

    // Create checkboxes for each dataframe and filling matching columns in the html
    dataframes.forEach(function(dataframe) {
      var $col = $('#labelAttributionForm label').filter(function() {
      return $(this).text().trim() === dataframe;
      }).closest('.form-group').find('div[style*="overflow-y: auto"]');
      if ($col.length) {
      allLabels.forEach(function(label) {
        var checkboxId = 'attribution_' + dataframe + '_' + label.replace(/\s+/g, '_');
        var isChecked = (attributionDic[dataframe] || []).indexOf(label) !== -1;
        var $checkbox = $('<div class="checkbox"><label><input type="checkbox" name="attribution_' + dataframe + '[]" value="' + label + '" id="' + checkboxId + '"' + (isChecked ? ' checked' : '') + '> ' + label + '</label></div>');
        $col.append($checkbox);
      });
      }
    });
  
  $('#labelAttributionModal').modal('show');
}

// Append a new label in uncategorized-labels
function addLabel(){

  var $ul = $('#uncategorized-labels').children('ul');
  if ($ul.length === 0) {
    $ul = $('<ul></ul>');
    $('#uncategorized-labels').append($ul);
  }
  $ul.append('<li><i class="icon-tag"></i> <span class="node-cpe">Nouvelle étiquette</span></li>');  DragAndDrop.enable($('#dragRoot li:last-child'));
}


function saveLabelOptions(){
  var $label = $('#labelConfigModal').data('labelElement');
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
  if (isAncestorWithSameName($label, newLabelName)) {
    $('#labelName').addClass('is-invalid');
    if ($('#labelName').next('.label-error-message').length === 0) {
      $('#labelName').after('<div class="label-error-message text-danger" style="font-size:0.9em;">L\'étiquette sélectionnée fait partie d\'un groupe dont le nom est celui que vous essayez d\'utiliser.</div>');
    }
    return false;
  }

  // Prevent same name as any descendant (excluding the label itself)
  var hasSameDescendant = hasDescendantSameName($label, newLabelName);
  if (hasSameDescendant) {
    $('#labelName').addClass('is-invalid');
    if ($('#labelName').next('.label-error-message').length === 0) {
      $('#labelName').after('<div class="label-error-message text-danger" style="font-size:0.9em;">Ce nom d\'étiquette fait déjà partie du groupe descendant de l\'étiquette sélectionnée.</div>');
    }
    return false;
  }

  // Prevent same name as any sibling
  if (hasSiblingSameName($label, newLabelName)) {
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
    if (!window.confirm("Toutes les étiquettes avec le même nom seront modifiées. Voulez-vous continuer ?")) {
      $('#labelConfigModal').modal('hide');
      return false;
    }
  }

  
  for (var i = 0; i < sameLabel.length; i++) {
    
    // Set font-weight and font-size based on header level
    var headerLevel = $('#labelHeaderLevel').val();
    switch(headerLevel) {
      case 'h1':
      sameLabel[i].addClass('h1');
      break;
      case 'h2':
      sameLabel[i].addClass('h2');
      break;
      case 'h3':
      sameLabel[i].addClass('h3');
      break;
      case 'h4':
      sameLabel[i].addClass('h4');
      break;
      case 'h5':
      sameLabel[i].addClass('h5');
      break;
      case 'h6':
      sameLabel[i].addClass('h6');
      break;
      default:
      sameLabel[i].css({'font-weight': '', 'font-style': '', 'font-size': '', 'color': ''});
    }

    sameLabel[i].text($('#labelName').val());
    sameLabel[i].css('color', $('#labelColor').val());
    sameLabel[i].data('attachedDataframes', $('#labelAttachedDataframes input:checked').map(function() {
      return $(this).val();
    }).get());
  }

  if (sameLabel.length > 1) {
    // Use helpers to sync all same-named labels
    var $ref = sameLabel[0];
    copyLabel($label, $ref);
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
  var dic = {racines: {racine_non_classifiées: [], racine_classifiées: []}, "liste des étiquettes": { non_classifiées: {}, classifiées: {} }};
  $('#uncategorized-labels .node-cpe').each(function() {
    var $label = $(this);
    dic["liste des étiquettes"]["non_classifiées"][$label.text()] = {
      color: $label.css('color'),
      attachedDataframes: $label.data('attachedDataframes') || [],
      font: $label.attr('class').split(' ').filter(function(c) {
        return c.startsWith('h');
      }).join(' ')
    };
  });
  
  $('#categorized-labels .node-cpe').each(function() {
    var $label = $(this);
    var children = [];
    // Only get direct children (first level)
    $label.closest('li').children('ul').children('li').children('.node-cpe').each(function() {
      children.push($(this).text());
    });
    children.sort();
    dic["liste des étiquettes"]["classifiées"][$label.text()] = {
      children: children,
      color: $label.css('color'),
      attachedDataframes: $label.data('attachedDataframes') || [],
      isDescendantsHidden: $label.attr('data-descendants-hidden'),
      font: $label.attr('class').split(' ').filter(function(c) {
        return c.startsWith('h');
      }).join(' ')
    };
  });

  dic["racines"]["racine_classifiées"] = $('#categorized-labels > ul > li').map(function() {
    return $(this).children('.node-cpe').text();
  }).get();

  dic["racines"]["racine_non_classifiées"] = $('#uncategorized-labels > ul > li').map(function() {
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
  var $newLabel = $("<li></li>").append($label.clone());
  copyLabel($newLabel, $label);
  var $ul = $('#uncategorized-labels > ul');
  if ($ul.length === 0) {
    $ul = $('<ul></ul>');
    $('#uncategorized-labels').append($ul);
  }
  $ul.append($newLabel);
  DragAndDrop.enable($newLabel);
  $('#labelConfigModal').modal('hide');
}

function onHoverNode(e, hovered){
  var $target = $(e.currentTarget);
  if (!hovered) {
    $('#dragRoot *[class*=node]').filter(function() {
      if ($(this).text() === $target.text()) {
        return $(this).removeClass("hovered");
      }
    });
  } else {
    $('#dragRoot *[class*=node]').filter(function() {
      
      if ($(this).text() === $target.text()) {
        return $(this).addClass("hovered");
      }
    });
  }
}

function saveLabelAttribution(){
  var data = {};
  $('#labelAttributionForm').serializeArray().forEach(function(item) {
    if (!data[item.name]) {
      data[item.name] = [];
    }
    data[item.name].push(item.value);
  });

  $('#dragRoot *[class*=node]').each(function() {
    var $label = $(this);
    var labelName = $label.text();
    var attached = [];
    for (var key in data) {
      if (data[key].indexOf(labelName) !== -1) {
        attached.push(key.replace(/^attribution_/, '').replace(/\[\]$/, ''));
      }
    }
    $label.data('attachedDataframes', attached);
  });
  
  $('#labelAttributionModal').modal('hide');
}