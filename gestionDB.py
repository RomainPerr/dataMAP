import pandas as pd
from flask import request
import requests as req
from io import BytesIO
from IPython.display import HTML
from bs4 import BeautifulSoup
import json

label_rows_number = 3

df = pd.read_excel('03_DB_MAP_Politiques.xlsx', 
                   header=[i for i in range(label_rows_number)], 
                   index_col=0, 
                   sheet_name="Politiques")

new_columns = []
for col in df.columns:
    col0 = "" if "Unnamed" in col[0] else col[0]
    col1 = "" if "Unnamed" in col[1] else col[1]
    col2 = "" if "Unnamed" in col[2] else col[2]
    new_columns.append((col0, col1, col2))
df.columns = pd.MultiIndex.from_tuples(new_columns)

def read_df(file_path, name, pwd, label_rows_number=3):

    r = req.request(
            method='get',
            url=file_path,
            auth = (name, pwd)
        )
    if r.status_code != 200:
        return None
    df = pd.read_excel(BytesIO(r.content), engine='calamine',
                        header=[i for i in range(label_rows_number)],
                        index_col=0)
    # Convert all column names to string
    df.columns = pd.MultiIndex.from_tuples(
        [tuple(str(item) for item in col) for col in df.columns])
    new_columns = []
    for col in df.columns:
        new_col= list(col)
        for i in range(label_rows_number):
            if ("Unnamed" in col[i]) or (col[i] == "/"):
                new_col[i] = ""
        new_columns.append(tuple(new_col))
    df.columns = pd.MultiIndex.from_tuples(new_columns)

    return df

def append_row(df, row):
    new_row_df = pd.DataFrame([row], columns=df.columns)
    if df.index.dtype.kind in 'iu':  # integer or unsigned integer
        next_index = df.index.max() + 1 if len(df.index) > 0 else 0
        new_row_df.index = [next_index]
    df = pd.concat([df, new_row_df])
    return df

def filter_df_by_column(df, column_name, value):
    return df[df[column_name].str.contains(value, na=False)]


def df_to_html(df, ColNotToShow):
    df = df.fillna('')
    if isinstance(df.columns, pd.MultiIndex):
        nom_cols = []
        for col in df.columns:
            if col[2] in ColNotToShow:
                nom_cols.append(col)
        df_toshow = df.drop(columns=nom_cols, errors='ignore')
    else:
        df_toshow = df.drop(columns=ColNotToShow, errors='ignore')

    df_toshow = df_toshow.drop(columns=[("","", "Etiquettes")], errors='ignore')

    df_toshow = df_toshow.reset_index()
    df_toshow = df_toshow.to_html(classes='table table-striped', index=False)

    # Add an action button at the end of each row

    soup = BeautifulSoup(df_toshow, "html.parser")
    table = soup.find("table")
    if table:
        # Add a delete button to each column header (third header row)
        header_rows = table.find_all("tr")
        if len(header_rows) >= 3:
            third_header = header_rows[2]
            ths = third_header.find_all("th")
            for idx, th in enumerate(ths):
                col_name = th.get_text(strip=True)
                # Skip the index column and action columns
                if col_name and col_name not in ColNotToShow:
                    th.append(soup.new_tag("br"))  # Add a line break before the button
                    th.append(soup.new_string(""))
                    btn = soup.new_tag(
                        "button",
                        **{
                            "class": "btn btn-danger btn-sm ms-2",
                            "type": "button",
                            "onclick": f"deleteColumn('{col_name}')"
                        }
                    )
                    btn.string = "Supprimer"
                    th.append(btn)

        # Add a button to each data row (skip header)
        for row in table.find_all("tr")[3:]:
            action_td = soup.new_tag("td")
            row_ID = row.find_all("td")[0].get_text(strip=True)
            button = soup.new_tag(
                "button", 
                **{
                    "class": "btn btn-primary", 
                    "type": "button",
                    "onclick": f"showDetails('{row_ID}')"
                    }
            )
            button.string = "Détails"
            action_td.append(button)
            row.append(action_td)

            del_td = soup.new_tag("td")
            # Get the row index (first cell value)
            
            button = soup.new_tag(
                "button",
                **{
                    "class": "btn btn-danger",
                    "type": "button",
                    "onclick": f"deleteRow('{row_ID}')"
                }
            )
            button.string = "Supprimer"
            del_td.append(button)
            row.append(del_td)

            label_td = soup.new_tag("td")
            # Get the row index (first cell value)
            
            button = soup.new_tag(
                "button",
                **{
                    "class": "btn btn-secondary",
                    "type": "button",
                    "onclick": f"openLabelsModal('{row_ID}')"
                }
            )
            button.string = "Étiquettes"
            label_td.append(button)
            row.append(label_td)
            
    df_toshow = str(soup)
    return df_toshow

def get_column_names(df, full=False):
    if df is not None:
        if full:
            columns=[[], [], []]
            for col in df.columns:
                if not (col[0] in columns[0] or col[0] == ""):
                    columns[0].append(col[0])

                if not (col[1] in columns[1] or col[1] == ""):
                    columns[1].append(col[1])

                if not (col[2] in columns[2] or col[2] == ""):
                    columns[2].append(col[2])
            return columns
            
        else:
            if isinstance(df.columns, pd.MultiIndex):
                return [col[2] for col in df.columns]
            elif isinstance(df.columns, pd.Index):
                return df.columns.tolist()
    else:
        print("No df to handle")
        return []

def row_columns_to_dict(df, rowID, raw_columns):
    if df is not None:
        row = df.iloc[int(rowID)]
        if row is not None:
            details = {}
            for raw_col in raw_columns:
                col = [c for c in df.columns if str(raw_col) in map(str, c)][0]
                value = row[col]
                # Convert pandas Timestamp to string
                if hasattr(value, 'isoformat'):
                    value = value.isoformat()
                # Replace NaN with None (will be serialized as null in JSON)
                if pd.isna(value):
                    value = "Non renseigné"
                details[str(raw_col)] = value

            return json.dumps(details), 200, {'Content-Type': 'application/json'}
    return "Error fetching row details.", 500

def delete_column(df, column_name):
    if df is not None:
        for col in df.columns:
            if col[2] == column_name:
                df = df.drop(columns=col, errors='ignore')
    return df

def add_column(df, request):
    col_name_1 = request.form.get('column_name_1')
    col_name_2 = request.form.get('column_name_2')
    col_name_3 = request.form.get('column_name_3')
    df[(col_name_1, col_name_2, col_name_3)] = ""
    
    titles=[]
    columns=[]
    for col in df.columns:
        if col[0] not in titles:
            titles.append(col[0])
            columns.append(col)
        else:
            columns.insert((len(titles)-titles[::-1].index(col[0])), col)
            titles.insert(titles.index(col[0])+1, col[0])
    df = df.reindex(columns=columns)

    titles = []
    columns = []
    for col in df.columns:
        if (col[0], col[1]) not in titles:
            titles.append((col[0], col[1]))
            columns.append(col)
        else:
            columns.insert((len(titles)-titles[::-1].index((col[0], col[1]))), col)
            titles.insert(titles.index((col[0], col[1]))+1, (col[0], col[1]))
    df = df.reindex(columns=columns)
    
    return df