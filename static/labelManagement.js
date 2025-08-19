// LOADING OF THE PAGE

window.onload = function() {
  var $root = $('#categorized-labels');
  buildLabelTree(labels["classifiées"], $root, labels["racine_classifiées"], isClassified = true);
  $root = $('#uncategorized-labels');
  buildLabelTree(labels["non_classifiées"], $root, labels["racine_non_classifiées"], isClassified = false);
};

function initToggle($ul){
  if ($ul.children('li').length > 0) {
    var $toggle = $('<span class="toggle-children" style="cursor:pointer; margin-right:4px;" title="Afficher/masquer les descendants">[–]</span>');
    $ul.prepend($toggle);

    $toggle.on('click', function(e) {
      e.stopPropagation();
      $ul.toggle();
      $toggle.text($ul.is(':visible') ? '[–]' : '[+]');
    });
  }
}

function buildLabelTree(labels, $root, roots, isClassified) {
  function createNode(label, data) {
    var $li = $('<li></li>');
    var $span = $('<span class="node-cpe"></span>').text(label).css({color: data.color}).data('attachedDataframes', data.attachedDataframes);
    $li.append('<i class="icon-tag"></i> ').append($span);

    // Add show/hide toggle if there are children
    if (data.children && data.children.length > 0 && isClassified) {
      var $toggle = $('<span class="toggle-children" style="cursor:pointer; margin-right:4px;" title="Afficher/masquer les descendants">[–]</span>');
      $li.prepend($toggle);

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

      if (data.isDescendantsHidden === "true") {
        // Les descendants sont masqués
        $ul.hide();
        $toggle.text('[+]');
        $span.attr('data-descendants-hidden', true);
      }

      // Toggle handler
      $toggle.on('click', function(e) {
        e.stopPropagation();
        var $this = $(this);
        $ul.toggle();
        $this.text($ul.is(':visible') ? '[–]' : '[+]');
        $span.attr('data-descendants-hidden', !$ul.is(':visible'));
      });
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
            if ($target.children('.toggle-children').length === 0 && $dstUL.children('li').length > 0) {
              var $toggle = $('<span class="toggle-children" style="cursor:pointer; margin-right:4px;" title="Afficher/masquer les descendants">[–]</span>');
              $target.prepend($toggle);
              $toggle.on('click', function(e) {
                e.stopPropagation();
                $dstUL.toggle();
                $toggle.text($dstUL.is(':visible') ? '[–]' : '[+]');
                $target.children('.node-cpe, .node-facility').first().attr('data-descendants-hidden', !$dstUL.is(':visible'));
              });
            }
            $('#dragRoot *[class*=node]').filter(function() {
                return $(this).text() === $target.find(".node-cpe, .node-facility").first().text() && this !== $target.find(".node-cpe, .node-facility").first()[0];
            }).each(function() {
              
              var $labelLi = $(this).closest("li");
              if ($labelLi[0] !== $item[0]) {
                var $labelUl = $labelLi.children("ul").first();
                if ($labelUl.length === 0) {
                  $labelUl = $("<ul></ul>");
                  $labelLi.append($labelUl);
                }
                var $clonedItem = $item.clone(false, false).show();
                DragAndDrop.enable($clonedItem);
                $labelUl.append($clonedItem);
                if ($labelLi.children('.toggle-children').length === 0 && $labelUl.children('li').length > 0) {
                  var $toggle = $('<span class="toggle-children" style="cursor:pointer; margin-right:4px;" title="Afficher/masquer les descendants">[–]</span>');
                  $labelLi.prepend($toggle);
                  $toggle.on('click', function(e) {
                    e.stopPropagation();
                    $labelUl.toggle();
                    $toggle.text($labelUl.is(':visible') ? '[–]' : '[+]');
                    $labelLi.children('.node-cpe, .node-facility').first().attr('data-descendants-hidden', !$labelUl.is(':visible'));
                  });
                }
                
              }
            });

            // Remove all children named as the moved label from all parents named as the original parent, except the moved item itself
            var srcParentLabelName = $srcUL.parent().closest('li').children('.node-cpe, .node-facility').first().text().trim();
            var movedLabelName = $item.find('.node-cpe, .node-facility').first().text().trim();

            $('#dragRoot li').each(function() {
              var $li = $(this);
              var $parentLabel = $li.children('.node-cpe, .node-facility').first();
              if ($parentLabel.length && $parentLabel.text().trim() === srcParentLabelName) {
              $li.children('ul').children('li').each(function() {
                var $childLi = $(this);
                var $childLabel = $childLi.children('.node-cpe, .node-facility').first();
                if (
                $childLabel.length &&
                $childLabel.text().trim() === movedLabelName &&
                $childLi[0] !== $item[0]
                ) {
                  $childLi.remove();
                  if ($childLi.parent().children().length === 0) {
                    $childLi.parent().remove();
                  }
                }
              });
              }
            });

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
        var $refLi = ref.closest('li');
        var $refUl = $refLi.children('ul').first();
        if ($refUl.length) {
          // Remove existing children ul
          $li.children('ul').remove();
          // Clone and append the ul
          var $clonedUl = $refUl.clone(false, false);
          DragAndDrop.enable($clonedUl);
          $li.append($clonedUl);
          // Add toggle if not present
          if ($li.children('.toggle-children').length === 0) {
            var $toggle = $('<span class="toggle-children" style="cursor:pointer; margin-right:4px;" title="Afficher/masquer les descendants">[–]</span>');
            $li.prepend($toggle);
            $toggle.on('click', function(e) {
              e.stopPropagation();
              $clonedUl.toggle();
              $toggle.text($clonedUl.is(':visible') ? '[–]' : '[+]');
              $node.attr('data-descendants-hidden', !$clonedUl.is(':visible'));
            });
          }
        }
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
  
  $(document).on("dblclick", "#dragRoot *[class*=node]", function(e) {
    if (!$(this).hasClass("non-editable")) {
      $(this).beginEditing();
      onHoverNode(e, false);
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
    var attached = $label.data('attachedDataframes') || [];
    $('#labelAttachedDataframes input[type="checkbox"]').each(function() {
      var val = $(this).val();
      $(this).prop('checked', attached.indexOf(val) !== -1);
    });
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
    // For each dataframe column, check the box if the label is in the dataframe's attached labels
    $('#labelAttributionForm input[type="checkbox"]').each(function() {
      var $checkbox = $(this);
      var labelName = $checkbox.val();
      var dataframe = $checkbox.attr('name').replace(/^attribution_/, '').replace(/\[\]$/, '');
      // Find the label element in the DOM to get its attachedDataframes
      var $labelElem = $('#dragRoot *[class*=node]').filter(function() {
        return $(this).text() === labelName;
      }).first();
      var attached = $labelElem.data('attachedDataframes') || [];
      $checkbox.prop('checked', attached.indexOf(dataframe) !== -1);
    });

    $('#labelAttributionModal').modal('show');

  });
  $(document).on("submit", "#labelAttributionForm", function(e) {
    e.preventDefault();
    saveLabelAttribution();
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
    if (!window.confirm("Toutes les étiquettes avec le même nom seront modifiées. Voulez-vous continuer ?")) {
      $('#labelConfigModal').modal('hide');
      return false;
    }
  }
  
  for (var i = 0; i < sameLabel.length; i++) {
    sameLabel[i].text($('#labelName').val());
    sameLabel[i].css('color', $('#labelColor').val());
    sameLabel[i].data('attachedDataframes', $('#labelAttachedDataframes input:checked').map(function() {
      return $(this).val();
    }).get());
  }

  if (sameLabel.length > 1) {
    // Find the first label with the same name (excluding the one being edited)
    var $first = sameLabel[0];
    // Copy its children UL (if any) to all other same-named labels (except itself)
    var $firstUl = $first.closest('li').children('ul').first();
    if ($firstUl.length) {
      for (var i = 1; i < sameLabel.length; i++) {
        var $li = sameLabel[i].closest('li');
        // Remove existing children ul
        $li.children('ul').remove();
        // Clone and append the ul
        // Deep clone the UL but remove any jQuery event handlers to avoid shared state
        var $clonedUl = $firstUl.clone(false, false);
        // Re-enable drag and drop on the new subtree
        DragAndDrop.enable($clonedUl);
        $li.append($clonedUl);
        if ($clonedUl.children('li').length > 0) {
          // Add toggle if not present
          if ($li.children('.toggle-children').length === 0) {
            var $toggle = $('<span class="toggle-children" style="cursor:pointer; margin-right:4px;" title="Afficher/masquer les descendants">[–]</span>');
            $li.prepend($toggle);
            $toggle.on('click', function(e) {
              e.stopPropagation();
              $clonedUl.toggle();
              $toggle.text($clonedUl.is(':visible') ? '[–]' : '[+]');
              sameLabel[i].attr('data-descendants-hidden', !$clonedUl.is(':visible'));
            });
          }
        }
      }
    }
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
      color: $label.css('color'),
      attachedDataframes: $label.data('attachedDataframes') || []
    };
  });
  
  $('#categorized-labels .node-cpe').each(function() {
    var $label = $(this);
    var children = [];
    // Only get direct children (first level)
    $label.closest('li').children('ul').children('li').children('.node-cpe').each(function() {
      children.push($(this).text());
    });
    dic.classifiées[$label.text()] = {
      children: children,
      color: $label.css('color'),
      attachedDataframes: $label.data('attachedDataframes') || [],
      isDescendantsHidden: $label.attr('data-descendants-hidden')
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
  $("#uncategorized-labels > ul").append($newLabel);
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