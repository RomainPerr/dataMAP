from flask import Flask, render_template, request, make_response, redirect, url_for, jsonify

import requests as req
from flask_wtf import FlaskForm
from wtforms import StringField, PasswordField, BooleanField
from wtforms.validators import InputRequired

import json
from flask_wtf.csrf import generate_csrf
from io import BytesIO
import pandas as pd
import nextcloud_client
import tempfile
import os

import gestionDB # functions related to the data display and data management

from pathlib import Path
THIS_FOLDER = Path(__file__).parent.resolve()

app = Flask(__name__)
app.config.from_pyfile(THIS_FOLDER / 'settings.py')

cache = {}



#helper functions

def uploadCache():
    global cache    

    with open(THIS_FOLDER / "cache.json", "w", encoding='utf-8') as fp:
        json.dump(cache, fp, ensure_ascii=False)
    return '', 204


def reinitCache():
    with open(THIS_FOLDER / "cache_reinit.json", "r", encoding='utf-8') as fp:
        try:
            global cache
            cache = json.load(fp)
            uploadCache()
        except json.JSONDecodeError:
            cache = {}
    return '', 204

def downloadCache():
    global cache

    if not os.path.exists(THIS_FOLDER / "cache.json") or os.path.getsize(THIS_FOLDER / "cache.json") == 0:
        reinitCache()
        return '', 204

    with open(THIS_FOLDER / "cache.json", "r", encoding='utf-8') as fp:
        try:
            cache = json.load(fp)
        except json.JSONDecodeError:
            reinitCache()
    return '', 204

downloadCache()





@app.route('/')
def index():
    return render_template('index.html')

class LoginForm(FlaskForm):
    name = StringField('Name', validators=[InputRequired()])
    pwd = PasswordField('Password', validators=[InputRequired()])

@app.route('/login', methods=['GET', 'POST'])
def make_loginform():
    form = LoginForm()
    if form.validate_on_submit():
        name = form.name.data
        pwd = form.pwd.data
        resp = make_response(redirect(url_for('index')))
        resp.set_cookie('name', name, path='/')
        resp.set_cookie('pwd', pwd, path='/')
        return resp
    return render_template('loginForm.html', form=form)


@app.route('/settings')
def settings():
    form = AddEntryForm()
    return render_template('settings.html', cache=cache["Paramètres"], csrf_token=generate_csrf(), form=form)

class AddEntryForm(FlaskForm):
    category = StringField('Category', validators=[InputRequired()])
    key = StringField('Name', validators=[InputRequired()])
    value = PasswordField('Password', validators=[InputRequired()])


#generic functions ton handle parameters : new parameters can be entered in the cache.json 
# file and will be reflected in the application automatically
@app.route('/addEntry', methods=['GET', 'POST'])
def addEntry(): 
    form = AddEntryForm()
    if form.validate_on_submit():
        category = form.category.data # the parameter being worked with
        key = form.key.data
        value = form.value.data
        if key and value:
            cache["Paramètres"][category][key] = value
            uploadCache()
    return redirect(url_for('settings'))

@app.route('/deleteEntry', methods=['POST'])
def deleteEntry():
    data = request.get_json()
    key = data.get('key')
    category = data.get('category')
    if category in cache["Paramètres"].keys() :
        if isinstance(cache["Paramètres"].get(category), dict) and key in cache["Paramètres"][category]:
            del cache["Paramètres"][category][key]
            uploadCache()
            return '', 204
        else :
            del cache["Paramètres"][key]
            uploadCache()
            return '', 204
    return '', 404

@app.route('/editEntry', methods=['POST'])
def editEntry():
    data = request.get_json()
    key = data.get('key')
    category = data.get('category')
    value = data.get('value')
    if category in cache["Paramètres"].keys():
        if isinstance(cache["Paramètres"].get(category), dict) and key in cache["Paramètres"][category]:
            cache["Paramètres"][category][key] = value
            uploadCache()
            return '', 204
        else :
            cache["Paramètres"][key] = value
            uploadCache()
            return '', 204
    return '', 404

@app.route('/menuDB')
def menuDB():
    return render_template('menuDB.html', cache=cache["Paramètres"])

#global variables which work as short term memory : they are used instead of reloading 
# the databases as long as the user is working with the same database
current_df = None
current_df_name = None
current_filter = None


@app.route('/gestionDB') #auto-reload without specifying database, it will use the current_df_name
def auto_render():
    return redirect(url_for('render', db=current_df_name if current_df_name else 'pas de base de données spécifiée'))

@app.route('/reinitialize-db-cache', methods=['GET'])
def reinitialize_db_cache():
    global current_df_name
    URL = cache["Paramètres"]['URL des fichiers de la base de données'][current_df_name]
    if URL in cache["Gestion de NextCloud"]["Correspondance URL des DB"]:
        del cache["Gestion de NextCloud"]["Correspondance URL des DB"][URL]
        df_to_reload_name = current_df_name
        current_df_name = None
        uploadCache()
    return jsonify({"df_to_reload": df_to_reload_name}), 200

@app.route('/gestionDB/<db>')
def render(db):
    global current_df
    global current_df_name
    global current_filter
    

    if db == 'pas de base de données spécifiée':
        return "No database specified. Please select a database from the menu.", 400
    
    
    if db != current_df_name:
        current_df_name = db
        URL = cache["Paramètres"]['URL des fichiers de la base de données'][db]
        if cache["Gestion de NextCloud"]["Correspondance URL des DB"].get(URL):
            # Test if the link in cache["Gestion de NextCloud"]["Correspondance URL des DB"][URL] is working
            test_url = cache["Gestion de NextCloud"]["Correspondance URL des DB"][URL]
            while True:
                try:
                    response = req.get(test_url, timeout=5)
                    if response.status_code == 200:
                        break
                    else:
                        # Instead of print, flash a message to the user and redirect to an error page
                        return redirect(url_for('db_loading_error'))
                except Exception as e:
                    return redirect(url_for('db_loading_error'))
            
            URL = cache["Gestion de NextCloud"]["Correspondance URL des DB"][URL]
        URL += "/download"

        df = gestionDB.read_df(URL, request.cookies.get('name'), request.cookies.get('pwd'))
        
        if df is None:
            return "Error fetching the database file. Please check your credentials or the URL.", 500
        current_df = df
        current_df.reset_index(drop=True, inplace=True)

        if cache["Affichage"].get(current_df_name) is None: #Affichage refers to the display settings for the current database, ie which columns are shown and which are "en détails"
            cache["Affichage"][current_df_name] = {"Colonnes en détails": []}
    
    new_cols = []
    i=1
    for col in current_df.columns:
        if col[0] == "" and col != ("Etiquettes", "Etiquettes", "Etiquettes"):
            new_cols.append(("Champ seul n°"+ str(i), col[1], col[2]))
            i += 1
        else:
            new_cols.append(col)
    current_df.columns = pd.MultiIndex.from_tuples(new_cols)

    current_df = gestionDB.orderColumns(current_df)

    attached_labels = [] # crawling all labels to see which ones are attached to the current dataframe
    for key, label in cache["Etiquettes"]["liste des étiquettes"]["classifiées"].items():
        for item in label["attachedDataframes"]:
            if item == current_df_name:
                attached_labels.append(key)
        
    if ("Etiquettes","Etiquettes", "Etiquettes") not in current_df.columns: #if labels columns does not exist yet, create it
        current_df[("Etiquettes","Etiquettes", "Etiquettes")] = ""


    ColNotToShow = gestionDB.listsListToTuplesLit(cache["Affichage"][current_df_name]["Colonnes en détails"]) if current_df_name in cache["Affichage"] else []
    columns = gestionDB.multiIndexToTuplesList(current_df.columns)
    columns = [col for col in columns if col != ("Etiquettes", "Etiquettes", "Etiquettes")]





    ColToShow = [col for col in columns if ((col not in ColNotToShow))]
    filter_data = {}
    for col in ColToShow:
        countUnique = current_df[col][current_df[col] != ""].nunique(dropna=True)
        count = len(current_df[col][current_df[col] != ""].dropna())
        if countUnique < count and any(val != "" for val in current_df[col]) and countUnique > 1:
            filter_data[gestionDB.colTupleToString(col)] = gestionDB.get_unique_values(current_df, col)
            if current_df[col].isna().any() or (current_df[col] == "").any():
                filter_data[gestionDB.colTupleToString(col)].append("non rempli") #mandatory use of a stringified key because tuples can't be used as keys outside python
    
    current_filter_html = {}
    if current_filter is not None:
        current_filter_html = {gestionDB.colTupleToString(k): v for k, v in current_filter.items()}


    df = gestionDB.df_to_html(current_df, ColNotToShow, current_filter)

    return render_template('gestionDB.html', df=df, columnsHTML=columns, attached_labels=attached_labels, filter_data=filter_data, current_filter = current_filter_html)


@app.route('/db_loading-error')
def db_loading_error():
    return render_template('error.html', message="La base de données que vous tentez d'ouvrir a déjà été manipulée par dataMAP, mais nous avons rencontré un problème lors du chargement du fichier modifié. Voulez-vous réinitialiser le travail sur cette base de données ? Les éventuelles modifications précédentes risquent d'être perdues.")

# Functions used in gestionDB.html

@app.route('/appendRow', methods=['POST'])
def appendRow():
    global current_df
    df = current_df
    data = request.get_json()
    newRow = {gestionDB.colStringToTuple(k): v for k, v in data.items()}
    df = gestionDB.append_row(df, newRow)
    current_df = df
    return '', 204

@app.route('/deleteRow', methods=['POST'])
def deleteRow():
    global current_df
    df = current_df
    data = request.get_json()
    rowID = data.get('rowID')
    if rowID is not None:
        df = df.drop(index=int(rowID), errors='ignore')
        current_df = df
        return '', 200
    return '', 200

# the columns which are not shown, the data is available when the "détails" button is clicked
@app.route('/rowDetails/<rowID>')
def rowDetails(rowID):
    global current_df
    df = current_df
    detailInfo = gestionDB.colStringToTuple(cache["Affichage"][current_df_name]["Colonnes en détails"])
    detailInfo = gestionDB.row_columns_to_dict(df, rowID, detailInfo)
    detailInfo = {gestionDB.colTupleToString(k): v for k, v in detailInfo.items()}
    return jsonify(detailInfo) 

@app.route('/getAffichageData')
def getAffichageData():
    colonnes_details = cache["Affichage"][current_df_name]["Colonnes en détails"]
    toutes_colonnes = gestionDB.multiIndexToTuplesList(current_df.columns)
    # Remove ('Etiquettes', 'Etiquettes', "Etiquettes") from toutes_colonnes if present
    toutes_colonnes = [col for col in toutes_colonnes if col != ("Etiquettes", "Etiquettes", "Etiquettes")]
    # Convert list of tuples to list of lists
    res = {
        "Colonnes en détails": gestionDB.tuplesListToListsList(colonnes_details),
        "Toutes les colonnes": gestionDB.tuplesListToListsList(toutes_colonnes)
    }
    return json.dumps(res), 200, {'Content-Type': 'application/json'}

@app.route('/setdetailcontent', methods=['POST'])
def setDetailContent():
    global cache
    data = request.get_json()
    if data is not None:
        cache["Affichage"][current_df_name]["Colonnes en détails"] = data.get('Colonne en détails')
        uploadCache()
        return '', 204

    return '', 404

@app.route('/deleteColumn', methods=['POST'])
def deleteColumn():
    global current_df
    df = current_df
    colName = tuple(request.get_json().get('column_name'))
    current_df = gestionDB.delete_column(df, colName)
    return '', 204

@app.route('/addColumn', methods=['POST'])
def addColumn():
    global current_df
    df = current_df
    current_df = gestionDB.add_column(df, request)
    return redirect(url_for('auto_render'))

if __name__ == '__main__':
   app.run()


# Function used in labelManagement.html
@app.route('/manageLabels')
def manageLabels():
    return render_template('labelManagement.html', labels=cache["Etiquettes"], dataframes=cache["Paramètres"]["URL des fichiers de la base de données"].keys())

@app.route('/save-labels', methods=['POST'])
def save_labels():
    global cache
    data = request.get_json()
    if data is not None:
        cache["Etiquettes"] = data
        uploadCache()
    return '', 404

@app.route('/save-label-attribution', methods=['POST'])
def save_label_attribution():
    global cache
    data = request.get_json()
    if data is not None:
        cache["Etiquettes"]["attribution des étiquettes"] = data
        uploadCache()
        return '', 204
    return '', 404

@app.route('/saveLabelAttribution', methods=['POST'])
def saveLabelAttribution():
    global cache
    global current_df
    data = request.get_json()
    rowID = data.get("rowID")
    labels = data.get("labels")
    if data is not None and labels is not None:
        # Convert labels list to a comma-separated string before assignment
        # Store labels as a list in the cell
        current_df.at[int(rowID), ("Etiquettes", "Etiquettes", "Etiquettes")] = labels
    return '', 204

@app.route('/getLabelsForRow/<rowID>')
def getLabelsForRow(rowID):
    global current_df
    df = current_df
    labels = df[("Etiquettes", "Etiquettes", "Etiquettes")].iloc[int(rowID)]
    if labels is None or labels == "" or (isinstance(labels, float) and pd.isna(labels)):
        labels = []
    return jsonify({"labels": labels}), 200

@app.route('/applyFilters', methods=['POST'])
def applyFilters():
    global current_filter
    current_filter = request.get_json()
    if current_filter is not None:
        # Convert all keys in current_filter from string to tuple using colStringToTuple
        current_filter = {gestionDB.colStringToTuple(k) if k != "Etiquettes" else k: v for k, v in current_filter.items()}
    



    if current_filter.get('Etiquettes'):
        # Get all selected labels and their children recursively
        def get_all_labels_with_children(selected_labels, classified_labels):
            result = set()
            def add_label_and_children(label):
                if label not in result:
                    result.add(label)
                    children = classified_labels.get(label, {}).get("children", [])
                    for child in children:
                        add_label_and_children(child)
            for label in selected_labels:
                add_label_and_children(label)
            return list(result)

        selected_labels = current_filter["Etiquettes"]
        classified_labels = cache["Etiquettes"]["liste des étiquettes"]["classifiées"]
        current_filter["Etiquettes"] = get_all_labels_with_children(selected_labels, classified_labels)
        
    return '', 204


@app.route('/exportData', methods=['POST'])
def exportData():
    global current_df
    df = current_df
    format = request.get_json().get('format')
    cols = request.get_json().get('columns', [])
    cols = gestionDB.listsListToTuplesLit(cols)
    df_filtered = gestionDB.filter_df(df, current_filter=current_filter)
    df_filtered = df_filtered[cols]
    
    # Remove leading and trailing rows where all columns are empty
    def is_row_empty(row):
        return all((pd.isna(x) or str(x).strip() == "") for x in row)

    if not df_filtered.empty:
        # Remove any totally empty row (all columns empty or NaN)
        df_filtered = df_filtered[~df_filtered.apply(is_row_empty, axis=1)]

    if format and cols:
        if format == 'csv':
            if df_filtered is None or df_filtered.empty or not cols:
                return 'No data to export.', 400
            response = make_response(df_filtered.to_csv(index=False, encoding='utf-8-sig'))
            response.headers['Content-Disposition'] = 'attachment; filename=data.csv'
            response.headers['Content-Type'] = 'text/csv; charset=utf-8'
            return response
        elif format == 'xlsx':
            output = BytesIO()
            with pd.ExcelWriter(output, engine='openpyxl') as writer:
                df_filtered.to_excel(writer, index=True, sheet_name='Sheet1')
            output.seek(0)
            response = make_response(output.read())
            response.headers['Content-Disposition'] = 'attachment; filename=data.xlsx'
            response.headers['Content-Type'] = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            return response
        elif format == 'raw':
            if len(cols) == 1:
                df_filtered = df_filtered[df_filtered[cols[0]].astype(str).str.strip() != ""]
            # Reconstruct the whole dataframe as a tab-separated string with newlines between rows
            tsv_data = df_filtered.to_csv(sep='\t', index=False, header=True, lineterminator='\n', encoding='utf-8')
            return json.dumps(tsv_data), 200, {'Content-Type': 'application/json; charset=utf-8'}
    return '', 204

@app.route('/updateCell', methods=['POST'])
def updateCell():
    global current_df

    data = request.get_json()
    row = data.get('row')
    col = tuple(data.get('col'))
    value = data.get('value')

    current_df[col].iloc[int(row)] = value

    return '', 204

@app.route('/updateHeaderNames', methods=['POST'])
def updateHeaderNames():
    global current_df
    ColNotToShow = gestionDB.listsListToTuplesLit(cache["Affichage"][current_df_name]["Colonnes en détails"]) if current_df_name in cache["Affichage"] else []

    data = request.get_json()
    headerID = data.get('headerID')
    newName = data.get('newHeaderValue')

    # Replace headers in current_df.columns that start with headerID by newName
    new_columns = []
    for col in current_df.columns:
        if isinstance(col, tuple) and col[:len(headerID)] == tuple(headerID):
            # Replace the last element in headerID with newName, keep the rest of the tuple
            new_col = tuple(list(col[:len(headerID)-1]) + [newName] + list(col[len(headerID):]))
            new_columns.append(new_col)
            if col in ColNotToShow:
                ColNotToShow = [new_col if c == col else c for c in ColNotToShow] #keeps order in ColNotToShow
        else:
            new_columns.append(col)

    cache["Affichage"][current_df_name]["Colonnes en détails"] = ColNotToShow
    uploadCache()

    current_df.columns = pd.MultiIndex.from_tuples(new_columns)        

    return '', 204

@app.route('/saveDatabase', methods=['POST'])
def saveDatabase():
    global current_df
    global current_df_name
    
    file_obj = gestionDB.df_to_xlsx(current_df, current_df_name + ".xlsx")
    file_obj.seek(0)  # Ensure we're at the start of the file
    nc = nextcloud_client.Client(cache["Paramètres"]["URL du client NextCloud"])
    nc.login(request.cookies.get('name'), request.cookies.get('pwd'))
    remote_path = cache["Paramètres"]["Dossier de téléversement des bases de données"]+ "/" + current_df_name + '.xlsx'
    # Write BytesIO to a temporary file
    with tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx") as tmp:
        tmp.write(file_obj.read())
        tmp_path = tmp.name
    try:
        nc.put_file(remote_path, tmp_path)
        link_info = nc.share_file_with_link(remote_path)
        
        URL = cache["Paramètres"]['URL des fichiers de la base de données'][current_df_name]
        cache["Gestion de NextCloud"]["Correspondance URL des DB"][URL] = link_info.get_link()
        uploadCache()
    finally:
        os.remove(tmp_path)
    return '', 204


@app.route('/saveCacheToNextcloud', methods=['GET'])
def saveCacheToNextcloud():  

    # nc = nextcloud_client.Client(cache["Paramètres"]["URL du client NextCloud"])
    # nc.login(request.cookies.get('name'), request.cookies.get('pwd'))
    # remote_path = cache["Paramètres"]["Dossier de fonctionnement"]+"/"+"NE_PAS_TOUCHER_donnees_fonctionnement"
    # nc.put_file(remote_path+'/cache.json', 'cache.json')
    
    nc = nextcloud_client.Client(cache["Paramètres"]["URL du client NextCloud"])
    nc.login(request.cookies.get('name'), request.cookies.get('pwd'))
    remote_path = cache["Paramètres"]["Dossier de fonctionnement"]+"/"+"NE_PAS_TOUCHER_donnees_fonctionnement"
    nc.put_file(remote_path+'/cache.json', THIS_FOLDER / 'cache.json')
    link_info = nc.share_file_with_link(remote_path+'/cache.json')
    print("Here is your link: " + link_info.get_link())

    return '', 204


@app.route('/getCacheFromNextCloud', methods=['GET'])
def getCacheFromNextCloud():

    nc = nextcloud_client.Client(cache["Paramètres"]["URL du client NextCloud"])
    nc.login(request.cookies.get('name'), request.cookies.get('pwd'))
    
    remote_path = cache["Paramètres"]["Dossier de fonctionnement"]+"/"+"NE_PAS_TOUCHER_donnees_fonctionnement"
    nc.get_file(remote_path+'/cache.json', THIS_FOLDER / 'cache.json')

    downloadCache()

    return '', 204