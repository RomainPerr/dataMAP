//basic CRUD operations 
function deleteRow(rowID) {
    fetch('/deleteRow', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': '{{ csrf_token }}'
        },
        body: JSON.stringify({ rowID: rowID })
    })
    .then(response => {
        if (response.ok) {
            location.reload();
        } else {
            alert('Erreur lors de la suppression de la ligne.');
        }
    })
    .catch(error => {
        alert('Erreur lors de la suppression de la ligne.');
    });
}

function deleteColumn(colName) {
    fetch('/deleteColumn', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': '{{ csrf_token }}'
        },
        body: JSON.stringify({ "column_name": colName })
    })
    .then(response => {
        if (response.ok) {
            location.reload();
        } else {
            alert('Erreur lors de la suppression de la colonne.');
        }
    })
    .catch(error => {
        alert('Erreur lors de la suppression de la colonne.');
    });
}

//functions regarding "détails"
function openAffichageModal() { // management of "détails" columns
    fetch('/getAffichageData')
        .then(response => response.json())
        .then(data => {
            const detailCols = data["Colonnes en détails"];
            const allCols = data["Toutes les colonnes"];
            const otherCols = allCols.filter(col => !detailCols.includes(col));

            const detailList = document.getElementById('detailCols');
            const otherList = document.getElementById('otherCols');
            detailList.innerHTML = '';
            otherList.innerHTML = '';

            detailCols.forEach(col => {
                let li = document.createElement('li');
                li.textContent = col;
                li.draggable = true;
                li.ondragstart = drag;
                li.style.cursor = 'grab';
                li.setAttribute('data-col', col);
                detailList.appendChild(li);
            });
            otherCols.forEach(col => {
                let li = document.createElement('li');
                li.textContent = col;
                li.draggable = true;
                li.ondragstart = drag;
                li.style.cursor = 'grab';
                li.setAttribute('data-col', col);
                otherList.appendChild(li);
            });

            document.getElementById('affichageModal').style.display = 'flex';
        });
}

function closeAffichageModal() {
    document.getElementById('affichageModal').style.display = 'none';
}

function allowDrop(ev) {
    ev.preventDefault();
}

function drag(ev) {
    ev.dataTransfer.setData("text", ev.target.getAttribute('data-col'));
    ev.dataTransfer.setData("sourceId", ev.target.parentElement.id);
}

function drop(ev, targetId) {
    ev.preventDefault();
    const col = ev.dataTransfer.getData("text");
    const sourceId = ev.dataTransfer.getData("sourceId");
    if (sourceId === targetId) return;
    const sourceList = document.getElementById(sourceId);
    const targetList = document.getElementById(targetId);
    let draggedItem;
    Array.from(sourceList.children).forEach(li => {
        if (li.getAttribute('data-col') === col) {
            draggedItem = li;
        }
    });
    if (draggedItem) {
        targetList.appendChild(draggedItem);
    }
}

function submitAffichage() {
    const detailCols = Array.from(document.getElementById('detailCols').children).map(li => li.getAttribute('data-col'));
    fetch('/setdetailcontent', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': '{{ csrf_token }}'
        },
        body: JSON.stringify({ 'Colonne en détails' : detailCols })
    })
    .then(response => {
        if (response.ok) {
            closeAffichageModal();
            location.reload();
        } else {
            alert('Erreur lors de la soumission.');
        }
    })
    .catch(() => {
        alert('Erreur lors de la soumission.');
    });
}



// Function to show a specific row "détails" modal
function showDetails(rowID) {
    // Create a modal overlay
    let modal = document.createElement('div');
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100vw';
    modal.style.height = '100vh';
    modal.style.background = 'rgba(0,0,0,0.5)';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.zIndex = '1000';

    // Create the modal content container
    let content = document.createElement('div');
    content.style.background = 'white';
    content.style.padding = '20px';
    content.style.borderRadius = '8px';
    content.style.minWidth = '300px';
    content.innerHTML = '<p>ID = ' + rowID + '</p>';

    // Add a close button
    let closeBtn = document.createElement('button');
    closeBtn.textContent = 'Fermer';
    closeBtn.onclick = () => document.body.removeChild(modal);
    content.appendChild(closeBtn);

    modal.appendChild(content);
    document.body.appendChild(modal);

    // Fetch the details for the row
    fetch(`/rowDetails/${rowID}`)
        .then(response => response.text())
        .then(text => {
            let details;
            try {
                details = JSON.parse(text);
            } catch {
                details = null;
            }
            let html = '<ul>';
            if (details && typeof details === 'object') {
                for (const [key, value] of Object.entries(details)) {
                    html += `<li><strong>${key}:</strong> ${value}</li>`;
                }
            } else {
                html += '<li>Aucune donnée disponible.</li>';
            }
            html += '</ul>';
            content.innerHTML = html;
            content.appendChild(closeBtn);
        })
        .catch(() => {
            content.innerHTML = '<p>Erreur lors du chargement des détails.</p>';
            content.appendChild(closeBtn);
        });
}




//Functions regarding labels

function openLabelsModal(rowID) {
    // Show the modal which is custom (not jQuery standard Modal)
    document.getElementById("labelsModal").style.display = "block";
    const form = document.getElementById("labelsForm");
    form.setAttribute("data-row-id", rowID);
    fetch(`/getLabelsForRow/${rowID}`)
        .then(response => response.json())
        .then(data => {
            const checkboxes = form.querySelectorAll('input[type="checkbox"][name="labels"]');
            checkboxes.forEach(checkbox => {
                checkbox.checked = data.labels.includes(checkbox.value);
            });
            // Sort the container divs (including label and checkbox) so checked ones appear first
            const labelDivs = Array.from(form.querySelectorAll('.label-checkbox')).map(cb => cb.parentElement);
            labelDivs.sort((a, b) => {
                const aChecked = a.querySelector('input[type="checkbox"][name="labels"]').checked ? 0 : 1;
                const bChecked = b.querySelector('input[type="checkbox"][name="labels"]').checked ? 0 : 1;
                if (aChecked !== bChecked) {
                    return aChecked - bChecked;
                }
                // Suborder alphabetically by label text
                const aLabel = a.querySelector('label') ? a.querySelector('label').textContent.trim().toLowerCase() : '';
                const bLabel = b.querySelector('label') ? b.querySelector('label').textContent.trim().toLowerCase() : '';
                return aLabel.localeCompare(bLabel);
            });
            labelDivs.forEach(div => form.removeChild(div));
            labelDivs.forEach(div => form.appendChild(div));
        })
        .catch(() => {
            alert('Erreur lors du chargement des étiquettes.');
        });
}

function closeLabelsModal() {
    document.getElementById("labelsModal").style.display = "none";
}


function saveLabelAttribution() {
    const form = document.getElementById("labelsForm");
    const rowID = form.getAttribute("data-row-id");
    const formData = new FormData(form);
    const completeData = {};
    completeData["rowID"] = rowID;
    completeData["labels"] = formData.getAll("labels");
    fetch('/saveLabelAttribution', {
        method: 'POST',
        body: JSON.stringify(completeData),
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => {
        if (response.ok) {
            closeLabelsModal();
            location.reload();
        } else {
            alert('Erreur lors de la sauvegarde des attributions.');
        }
    })
    .catch(() => {
        alert('Erreur lors de la sauvegarde des attributions.');
    });
}