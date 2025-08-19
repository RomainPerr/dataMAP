

function openLabelsModal(rowID) {
    // Show the modal
    document.getElementById("labelsModal").style.display = "block";
    const form = document.getElementById("labelsForm");
    form.setAttribute("data-row-id", rowID);
    fetch(`/getLabelsForRow/${rowID}`)
        .then(response => response.json())
        .then(data => {
            // data.labels is an array of label names to check
            const checkboxes = form.querySelectorAll('input[type="checkbox"][name="labels"]');
            checkboxes.forEach(checkbox => {
                checkbox.checked = data.labels.includes(checkbox.value);
            });
        })
        .catch(() => {
            // Optionally handle error
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