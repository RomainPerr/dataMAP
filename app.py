from flask import Flask, render_template, request, make_response, redirect, url_for

import requests as req
from flask_wtf import FlaskForm
from wtforms import StringField, PasswordField, BooleanField
from wtforms.validators import InputRequired

import json
from flask_wtf.csrf import generate_csrf

import gestionDB


app = Flask(__name__)
app.config.from_pyfile('settings.py')

cache = {}
with open("cache.json", "r", encoding='utf-8') as fp:
    cache = json.load(fp)

DBs = [[]]

@app.route('/')
def index():
    DBs = [[]]
    return render_template('index.html', list=DBs)

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

@app.route('/getname')
def getname():
    NAME = request.cookies.get('name')
    if NAME is None:
        return 'No name cookie found'
    return 'login : ' + NAME + ' password : ' + request.cookies.get('pwd')





@app.route('/settings')
def settings():
    form = AddEntryForm()
    return render_template('settings.html', cache=cache["Paramètres"], csrf_token=generate_csrf(), form=form)

class AddEntryForm(FlaskForm):
    category = StringField('Category', validators=[InputRequired()])
    key = StringField('Name', validators=[InputRequired()])
    value = PasswordField('Password', validators=[InputRequired()])

@app.route('/addEntry', methods=['GET', 'POST'])
def addEntry():
    form = AddEntryForm()
    if form.validate_on_submit():
        category = form.category.data
        key = form.key.data
        value = form.value.data
        if key and value:
            cache["Paramètres"][category][key] = value
            with open("cache.json", "w", encoding='utf-8') as fp:
                json.dump(cache, fp, ensure_ascii=False)
        return redirect(url_for('settings'))
    return render_template('settings.html', cache=cache["Paramètres"], csrf_token=generate_csrf(), form=form)

@app.route('/deleteEntry', methods=['POST'])
def deleteEntry():
    data = request.get_json()
    key = data.get('key')
    category = data.get('category')
    if category in cache["Paramètres"].keys() :
        if isinstance(cache["Paramètres"].get(category), dict) and key in cache["Paramètres"][category]:
            del cache["Paramètres"][category][key]
            with open("cache.json", "w", encoding='utf-8') as fp:
                json.dump(cache, fp, ensure_ascii=False)
            return '', 204
        else :
            del cache["Paramètres"][key]
            with open("cache.json", "w", encoding='utf-8') as fp:
                json.dump(cache, fp, ensure_ascii=False)
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
            with open("cache.json", "w", encoding='utf-8') as fp:
                json.dump(cache, fp, ensure_ascii=False)
            return '', 204
        else :
            cache["Paramètres"][key] = value
            with open("cache.json", "w", encoding='utf-8') as fp:
                json.dump(cache, fp, ensure_ascii=False)
            return '', 204
    return '', 404

@app.route('/menuDB')
def menuDB():
    return render_template('menuDB.html', cache=cache["Paramètres"])

current_df = None
current_df_name = None

@app.route('/gestionDB')
def auto_render():
    return redirect(url_for('render', db=current_df_name if current_df_name else 'pas de base de données spécifiée'))

@app.route('/gestionDB/<db>')
def render(db):
    global current_df
    global current_df_name

    if db == 'pas de base de données spécifiée':
        return "No database specified. Please select a database from the menu.", 400

    if db != current_df_name:
        df = gestionDB.read_df(cache["Paramètres"]['URL des fichiers de la base de données'][db], 
                                            request.cookies.get('name'), 
                                            request.cookies.get('pwd'))
        if df is None:
            return "Error fetching the database file. Please check your credentials or the URL.", 500
        current_df = df
        current_df.reset_index(drop=True, inplace=True)
        current_df_name = db
        if cache["Affichage"].get(current_df_name) is None:
            cache["Affichage"][current_df_name] = {"Colonnes en détails": []}
    columns = gestionDB.get_column_names(current_df, full=False)
    form = AddRowForm()
    ColNotToShow = cache["Affichage"][current_df_name]["Colonnes en détails"] if current_df_name in cache["Affichage"] else []
    full_columns_names = gestionDB.get_column_names(current_df, full = True)
    return render_template('gestionDB.html', df=gestionDB.df_to_html(current_df, ColNotToShow), columns=columns, form=form, full_columns=full_columns_names)


class AddRowForm(FlaskForm):
    global current_df
    db = StringField('db')
    for col in gestionDB.get_column_names(current_df):
        col = StringField(col)

@app.route('/appendRow', methods=['POST'])
def appendRow():
    global current_df
    df = current_df
    form = AddRowForm()
    if form.validate_on_submit():
        new_row = [request.form.get(col) for col in gestionDB.get_column_names(df)]
        df = gestionDB.append_row(df, new_row)
        current_df = df
        return redirect(url_for('auto_render'))
    return redirect(url_for('auto_render'))

@app.route('/deleteRow', methods=['POST'])
def deleteRow():
    global current_df
    df = current_df
    data = request.get_json()
    rowID = data.get('rowID')
    if rowID is not None:
        df = df.drop(index=int(rowID), errors='ignore')
        current_df = df
        columns = gestionDB.get_column_names(df)
        return '', 200
    columns = gestionDB.get_column_names(df)
    return '', 200




@app.route('/rowDetails/<rowID>')
def rowDetails(rowID):
    global current_df
    df = current_df
    return gestionDB.row_columns_to_dict(df, rowID, cache["Affichage"][current_df_name]["Colonnes en détails"])

@app.route('/getAffichageData')
def getAffichageData():
    res = {"Colonnes en détails": cache["Affichage"][current_df_name]["Colonnes en détails"], "Toutes les colonnes": gestionDB.get_column_names(current_df)}
    return json.dumps(res), 200, {'Content-Type': 'application/json'}

@app.route('/setdetailcontent', methods=['POST'])
def setDetailContent():
    global cache
    data = request.get_json()
    if data is not None:
        cache["Affichage"][current_df_name]["Colonnes en détails"] = data.get('Colonne en détails')
        with open("cache.json", "w", encoding='utf-8') as fp:
            json.dump(cache, fp, ensure_ascii=False)
        return '', 204
    return '', 404

@app.route('/deleteColumn', methods=['POST'])
def deleteColumn():
    global current_df
    df = current_df
    colName = request.get_json().get('column_name')
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

@app.route('/manageLabels')
def manageLabels():
    return render_template('labelManagement.html', labels=cache["Etiquettes"]["liste des étiquettes"])

@app.route('/save-labels', methods=['POST'])
def save_labels():
    global cache
    data = request.get_json()
    if data is not None:
        cache["Etiquettes"]["liste des étiquettes"] = data
        with open("cache.json", "w", encoding='utf-8') as fp:
            json.dump(cache, fp, ensure_ascii=False)
        return '', 204
    return '', 404