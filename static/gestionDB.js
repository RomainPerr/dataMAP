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
    // Create or get the search bar
    let searchBar = document.getElementById('labelsSearchBar');
    if (!searchBar) {
        searchBar = document.createElement('input');
        searchBar.type = 'text';
        searchBar.id = 'labelsSearchBar';
        searchBar.placeholder = 'Rechercher une étiquette...';
        searchBar.style.marginBottom = '10px';
        form.insertBefore(searchBar, form.firstChild);
    }

    var data = {};
    // Helper to sort and display checkboxes
    function sortAndDisplayCheckboxes(filterText = '') {
        const checkboxes = form.querySelectorAll('input[type="checkbox"][name="labels"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = data.labels.includes(checkbox.value);
        });
        
        // Sort the container divs (including label and checkbox)
        const labelDivs = Array.from(form.querySelectorAll('.label-checkbox')).map(cb => cb.parentElement);
        labelDivs.sort((a, b) => {
            // 1. Checked first
            const aChecked = a.querySelector('input[type="checkbox"][name="labels"]').checked ? 0 : 1;
            const bChecked = b.querySelector('input[type="checkbox"][name="labels"]').checked ? 0 : 1;
            if (aChecked !== bChecked) return aChecked - bChecked;
            // 2. Filter match first
            const aLabel = a.querySelector('label') ? a.querySelector('label').textContent.trim().toLowerCase() : '';
            const bLabel = b.querySelector('label') ? b.querySelector('label').textContent.trim().toLowerCase() : '';
            const filter = filterText.trim().toLowerCase();
            const aMatch = filter && aLabel.includes(filter) ? 0 : 1;
            const bMatch = filter && bLabel.includes(filter) ? 0 : 1;
            if (aMatch !== bMatch) return aMatch - bMatch;
            // 3. Alphabetical
            return aLabel.localeCompare(bLabel);
        });
        labelDivs.forEach(div => form.removeChild(div));
        labelDivs.forEach(div => form.appendChild(div));
    }

    fetch(`/getLabelsForRow/${rowID}`)
        .then(response => response.json())
        .then(responseData => {
            data = responseData;
            sortAndDisplayCheckboxes();
        })
        .catch(() => {
            alert('Erreur lors du chargement des étiquettes.');
        });

    // Add event listener for dynamic search
    searchBar.oninput = () => {
        const checkboxes = form.querySelectorAll('input[type="checkbox"][name="labels"]');
        data.labels = Array.from(checkboxes)
            .filter(cb => cb.checked)
            .map(cb => cb.value);
        sortAndDisplayCheckboxes(searchBar.value);
    };
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

//FILTERING MODAL

function openFilterModal() {
    document.getElementById('filterModal').style.display = 'flex';
    renderFilterColumns();
}
function closeFilterModal() {
    document.getElementById('filterModal').style.display = 'none';
}

function renderFilterColumns() {
    const labelsContainer = document.getElementById('filterLabels');
    labelsContainer.innerHTML = '';
    var shownColumns = Object.keys(filterData);

    // Render the "Étiquettes" filter section
    const etiquettesDiv = document.createElement('div');
    etiquettesDiv.style.minWidth = '180px';
    etiquettesDiv.innerHTML = `
        <div style="font-weight:bold; margin-bottom:4px;">Etiquettes</div>
        <input type="text" placeholder="Rechercher..." oninput="filterLabels('Etiquettes', this.value)" style="width:100%; margin-bottom:8px;" id="search_Etiquettes">
        <div style="display: flex; gap: 40px; margin-bottom: 16px;">
            <button type="button" onclick="unselectAll('Etiquettes')">Tout désélectionner</button>
        </div>
        <div id="labels_Etiquettes">
            ${attachedLabels.map(label => `
                <div>
                    <input type="checkbox" name="Etiquettes" value="${label}" id="cb_Etiquettes_${label}">
                    <label for="cb_Etiquettes_${label}">${label}</label>
                </div>
            `).join('')}
        </div>
    `;
    etiquettesDiv.setAttribute('data-col-index', -1);
    labelsContainer.appendChild(etiquettesDiv);

    const container = document.getElementById('filterColumns');
    container.innerHTML = '';
    shownColumns.forEach(col => {
        const labels = filterData[col] || [];
        const colDiv = document.createElement('div');
        colDiv.style.minWidth = '180px';
        colDiv.innerHTML = `
            <div style="font-weight:bold; margin-bottom:4px;">${col}</div>
            <input type="text" placeholder="Rechercher..." oninput="filterLabels('${col}', this.value)" style="width:100%; margin-bottom:8px;" id="search_${col}">
            <div style="display: flex; gap: 40px; margin-bottom: 16px;">
                <button type="button" onclick="unselectAll('${col}')">Tout désélectionner</button>
            </div>
            <div id="labels_${col}">
                ${labels.map(label => `
                    <div>
                        <input type="checkbox" name="${col}" value="${label}" id="cb_${col}_${label}">
                        <label for="cb_${col}_${label}">${label}</label>
                    </div>
                `).join('')}
            </div>
        `;
        colDiv.setAttribute('data-col-index', shownColumns.indexOf(col));
        container.appendChild(colDiv);
    });
    // Initial rendering of labels with current filter
    if (typeof currentFilter === 'object') {
        Object.keys(currentFilter).forEach(col => {
            filterLabels(col, '', true);
        });
    }
}

function filterLabels(col, search, isInitialRender = false) {
    const labelsDiv = document.getElementById('labels_' + col);
    // Get the text content of all label elements inside labelsDiv
    let labels = [];
    if (col != "Etiquettes") {
        labels = filterData[col] || [];
    }else{
        labels = attachedLabels;
    }
    const searchLower = search.toLowerCase();

    // Get checked values before re-rendering
    const checkedValues = new Set(
        Array.from(labelsDiv.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value)
    );



    // On initial render, set checkedValues from currentFilter if available
    if (isInitialRender === true && typeof currentFilter === 'object' && currentFilter[col]) {
        checkedValues.clear();
        currentFilter[col].forEach(val => checkedValues.add(val));
    }

    let sorted;
    if (searchLower === '') {
        // Checked first, then alphabetical
        sorted = labels.slice().sort((a, b) => {
            const aChecked = checkedValues.has(a) ? 0 : 1;
            const bChecked = checkedValues.has(b) ? 0 : 1;
            if (aChecked !== bChecked) return aChecked - bChecked;
            return a.localeCompare(b);
        });
    } else {
        // Matching search first, then alphabetical
        sorted = labels.slice().sort((a, b) => {
            const aMatch = a.toLowerCase().includes(searchLower);
            const bMatch = b.toLowerCase().includes(searchLower);
            if (aMatch && !bMatch) return -1;
            if (!aMatch && bMatch) return 1;
            return a.localeCompare(b);
        });
    }

    labelsDiv.innerHTML = sorted.map(label => `
        <div>
            <input type="checkbox" name="${col}" value="${label}" id="cb_${col}_${label}"${checkedValues.has(label) ? ' checked' : ''}>
            <label for="cb_${col}_${label}">${label}</label>
        </div>
    `).join('');
}

function applyFilters() {
    const form = document.getElementById('filterForm');
    const formData = new FormData(form);
    const filters = {};
    for (let [key, value] of formData.entries()) {
        if (!filters[key]) filters[key] = [];
        filters[key].push(value);
    }
    
    fetch('/applyFilters', {
        method: 'POST',
        body: JSON.stringify(filters),
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => {
        if (response.ok) {
            closeFilterModal();
            location.reload();
        } else {
            alert('Erreur lors de l\'application des filtres.');
        }
    })
    .catch(() => {
        alert('Erreur lors de l\'application des filtres.');
    });
}

function unselectAll(col) {
    const labelsDiv = document.getElementById('labels_' + col);
    if (!labelsDiv) return;
    const checkboxes = labelsDiv.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = false);
}

// EXPORT MODAL

function openExportModal() {
    document.getElementById('exportModal').style.display = 'flex';
    renderExportColumns();
    document.getElementById('rawExportArea').style.display = 'none';
}
function closeExportModal() {
    document.getElementById('exportModal').style.display = 'none';
}
function renderExportColumns() {
    const container = document.getElementById('exportColumns');
    container.innerHTML = '';
    (shownColumns || []).forEach(col => {
        const div = document.createElement('div');
        div.innerHTML = `<label><input type="checkbox" name="exportCols" value="${col}"> ${col}</label>`;
        container.appendChild(div);
    });
}
document.querySelectorAll('input[name="exportFormat"]').forEach(el => {
    el.addEventListener('change', function() {
        if (this.value === 'raw') {
            showRawExport();
        } else {
            document.getElementById('rawExportArea').style.display = 'none';
        }
    });
});
function getSelectedExportColumns() {
    return Array.from(document.querySelectorAll('#exportColumns input[type=checkbox]:checked')).map(cb => cb.value);
}
function submitExport() {
    const format = document.querySelector('input[name="exportFormat"]:checked').value;
    const cols = getSelectedExportColumns();
    if (cols.length === 0) {
        alert('Sélectionnez au moins une colonne.');
        return;
    }
    if (format === 'raw') {
        showRawExport();
        return;
    }
    fetch('/exportData', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({columns: cols, format: format})
    })
    .then(response => {
        if (format === 'csv' || format === 'xlsx') {
            return response.blob();
        }
        return response.text();
    })
    .then(data => {
        if (format === 'csv' || format === 'xlsx') {
            const ext = format === 'csv' ? 'csv' : 'xlsx';
            const url = window.URL.createObjectURL(data);
            const a = document.createElement('a');
            a.href = url;
            a.download = `export.${ext}`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        }
    });
}
function showRawExport() {
    const cols = getSelectedExportColumns();
    fetch('/exportData', {
        method: 'POST',
        headers: {'Content-Type': 'application/json; charset=utf-8'},
        body: JSON.stringify({columns: cols, format: 'raw'})
    })
    .then(response => response.json())
    .then(tsv_data => {
        // tsv_data is a string, but may have unicode escapes
        let processed = tsv_data;
        // Decode unicode escapes (e.g., \u00e9)
        processed = processed.replace(/\\u([\dA-F]{4})/gi, function (match, grp) {
            return String.fromCharCode(parseInt(grp, 16));
        });
        // Remove leading/trailing quotes if present
        processed = processed.replace(/^"|"$/g, '');
        // Replace escaped newlines and tabs
        processed = processed.replace(/\\n/g, '\n').replace(/\\t/g, '\t');

        document.getElementById('rawExportText').textContent = processed;
        document.getElementById('rawExportArea').style.display = 'block';
    }).then(copyRawExport);
    
}
function copyRawExport() {
    const textarea = document.getElementById('rawExportText');
    const lines = textarea.value.split('\n');
    if (lines.length > 1) {
        const textToCopy = lines.slice(1).join('\n');
        navigator.clipboard.writeText(textToCopy).then(() => {
        });
    } else {
        alert('Aucune donnée à copier.');
    }
}

// VERTICAL SELECTION

document.addEventListener('DOMContentLoaded', function() {
    const table = document.querySelector('#mainTable');
    if (!table) return;

    let selecting = false;
    let startRow = null, endRow = null;
    let startCol = null, endCol = null;

    // Add a class for highlighting
    const style = document.createElement('style');
    style.innerHTML = `
        .cell-selected {
            background: #c8e6c9 !important;
        }
    `;
    document.head.appendChild(style);

    // Helper to get cell's column index
    function getColIndex(cell) {
        return Array.from(cell.parentNode.children).indexOf(cell);
    }

    // Mouse events for all cells
    Array.from(table.rows).forEach((row, rowIdx) => {
        Array.from(row.cells).forEach((cell, cellIdx) => {
            cell.style.cursor = 'pointer';
            cell.addEventListener('mousedown', function(e) {
                selecting = true;
                startRow = rowIdx;
                endRow = rowIdx;
                startCol = cellIdx;
                endCol = cellIdx;
                highlightCells();
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
                e.preventDefault();
            });
        });
    });

    function onMouseMove(e) {
        if (!selecting) return;
        const cell = document.elementFromPoint(e.clientX, e.clientY);
        if (!cell || (cell.tagName !== 'TD' && cell.tagName !== 'TH')) return;
        const row = cell.parentNode;
        if (!row || !row.parentNode) return;
        const rowIdx = Array.from(table.rows).indexOf(row);
        const cellIdx = getColIndex(cell);
        if (rowIdx !== -1 && cellIdx !== -1) {
            endRow = rowIdx;
            endCol = cellIdx;
            highlightCells();
        }
    }

    function onMouseUp(e) {
        selecting = false;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    }

    function highlightCells() {
        const minRow = Math.min(startRow, endRow);
        const maxRow = Math.max(startRow, endRow);
        const minCol = Math.min(startCol, endCol);
        const maxCol = Math.max(startCol, endCol);
        Array.from(table.rows).forEach((row, rIdx) => {
            Array.from(row.cells).forEach((cell, cIdx) => {
                if (
                    rIdx >= minRow && rIdx <= maxRow &&
                    cIdx >= minCol && cIdx <= maxCol
                ) {
                    cell.classList.add('cell-selected');
                } else {
                    cell.classList.remove('cell-selected');
                }
            });
        });
    }

    // Only handle copy if focus is inside the table
    document.addEventListener('keydown', function(e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
            const active = document.activeElement;
            // If focus is on an input, textarea, or contenteditable, let default copy happen
            if (
                active &&
                (
                    active.tagName === 'INPUT' ||
                    active.tagName === 'TEXTAREA' ||
                    active.isContentEditable
                )
            ) {
                return;
            }
            // Only handle copy if a selection exists
            const minRow = Math.min(startRow, endRow);
            const maxRow = Math.max(startRow, endRow);
            const minCol = Math.min(startCol, endCol);
            const maxCol = Math.max(startCol, endCol);
            // Check if a selection is present (not just a single cell)
            if (startRow === null || startCol === null || endRow === null || endCol === null) {
                return;
            }
            const selected = [];
            for (let r = minRow; r <= maxRow; r++) {
                const row = table.rows[r];
                if (!row) continue;
                const rowData = [];
                for (let c = minCol; c <= maxCol; c++) {
                    if (row.cells[c]) {
                        rowData.push(row.cells[c].innerText);
                    }
                }
                selected.push(rowData.join('\t'));
            }
            if (selected.length > 0) {
                const text = selected.join('\n');
                navigator.clipboard.writeText(text);
                e.preventDefault();
            }
        }
    });

    // Remove selection when clicking outside the table
    document.addEventListener('mousedown', function(e) {
        if (!table.contains(e.target)) {
            startRow = endRow = startCol = endCol = null;
            Array.from(table.querySelectorAll('.cell-selected')).forEach(cell => {
                cell.classList.remove('cell-selected');
            });
        }
    });
});