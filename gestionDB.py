import pandas as pd
from flask import request
import requests as req
from io import BytesIO
from IPython.display import HTML
from bs4 import BeautifulSoup
import json
from collections import OrderedDict

label_rows_number = 3 # Number of header rows in the Excel file, not really modifiable as is for addColumn() assumes 3 as many other functions


#Some basic type helper functions
def colTupleToString(colTuple):
    if isinstance(colTuple, list):
        return ['||'.join(map(str, col)) for col in colTuple]
    elif isinstance(colTuple, tuple):
        return '||'.join(map(str, colTuple))
    else:
        return str(colTuple)

def colStringToTuple(colString):
    if isinstance(colString, str):
        return tuple(colString.split("||"))
    elif isinstance(colString, list):
        # Check if it's a list of strings or a list of lists
        if all(isinstance(item, str) for item in colString):
            return [tuple(item.split("||")) for item in colString]
        elif all(isinstance(item, list) for item in colString):
            return [tuple(item) for item in colString]
    return colString

def multiIndexToTuplesList(multiIndex):
    if isinstance(multiIndex, pd.MultiIndex):
        return [tuple(map(str, col)) for col in multiIndex]
    return []

def listsListToTuplesLit(lists):
    if isinstance(lists, list):
        return [tuple(map(str, item)) for item in lists]
    return []

def tuplesListToListsList(tuples):
    if isinstance(tuples, list):
        return [list(item) for item in tuples]
    return []


def orderColumns(df):
    # Check for duplicate columns in MultiIndex or Index
    seen = set()
    duplicates = set()
    for col in df.columns:
        if col in seen:
            duplicates.add(col)
        else:
            seen.add(col)

    # Order columns by first element, then by second element within each group, preserving original order otherwise
    cols = list(df.columns)
    if not cols:
        return df

    # Group columns by first element, then by second element
    grouped = OrderedDict()
    for col in cols:
        first, second = col[0], col[1]
        if first not in grouped:
            grouped[first] = OrderedDict()
        if second not in grouped[first]:
            grouped[first][second] = []
        grouped[first][second].append(col)

    # Reconstruct columns: order by first, then by second, then original order
    new_cols = []
    for first_group in grouped.values():
        for second_group in first_group.values():
            new_cols.extend(second_group)

    if cols != new_cols:
        df = df.reindex(columns=new_cols)
    return df

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
    
    # Remove '.0' at the end of any string value in the DataFrame
    df = df.applymap(lambda x: str(x)[:-2] if isinstance(x, float) and str(x).endswith('.0') else x)

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

    # Convert DataFrame to HTML, preserving \n and \r as <br> for display --> induces problem because ugly version remains at some places, maybe place it before
    def replace_newlines(val):
        if isinstance(val, str):
            return val.replace('\r\n', '<br>').replace('\r', '<br>').replace('\n', '<br>')
        return val

    # Replace newlines in data
    df = df.map(replace_newlines)

    # Replace newlines in column headers (MultiIndex or Index)
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = pd.MultiIndex.from_tuples(
            [tuple(replace_newlines(level) for level in col) for col in df.columns]
        )
    else:
        df.columns = [replace_newlines(col) for col in df.columns]

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

def filter_df(df, current_filter):
    df = df.fillna('')
    
    if current_filter:
        for key, values in current_filter.items():
            if "non rempli" in values:
                values += ['']
            if key == "Etiquettes":
                df = df[df[("Etiquettes","Etiquettes", "Etiquettes")].apply(
                    lambda etiquettes: (
                        any(e in values for e in etiquettes) if isinstance(etiquettes, list)
                        else etiquettes in values
                    )
                )]
            else:
                df = df[df[key].isin(values)]

    df = df.drop(columns=[("Etiquettes","Etiquettes", "Etiquettes")], errors='ignore')
    return df

# Function to convert DataFrame to HTML shown in gestionDB.html
def df_to_html(df, ColNotToShow, current_filter):
    df_toshow = filter_df(df, current_filter=current_filter)

    df_toshow = df_toshow.drop(columns=ColNotToShow, errors='ignore')
            
    df_toshow = df_toshow.reset_index()

    # Create lists of future IDs for 2nd and 3rd level headers
    future_first_level_ids = []
    future_second_level_ids = []
    future_third_level_ids = []

    if isinstance(df_toshow.columns, pd.MultiIndex):
        for col in df_toshow.columns:
            if col[0] not in future_first_level_ids:
                future_first_level_ids.append((col[0]))
            # For 2nd level: add first level header if not already present
            if (col[0], col[1]) not in future_second_level_ids:
                future_second_level_ids.append((col[0], col[1]))
            # For 3rd level: add (first, second) tuple if not already present
            if (col[0], col[1], col[2]) not in future_third_level_ids:
                future_third_level_ids.append((col[0], col[1], col[2]))

    

    df_toshow = df_toshow.to_html(classes='table table-striped', index=False, escape=False)

    soup = BeautifulSoup(df_toshow, "html.parser")
    table = soup.find("table")
    if table:
        table['id'] = "mainTable"
        # Add a delete button to each column header (third header row)
        header_rows = table.find_all("tr")
        
        if len(header_rows) >= 3:
            # Add id attributes to each header cell in the three header rows
            first_header = header_rows[0]
            second_header = header_rows[1]
            third_header = header_rows[2]

            # First header row: assign id from future_first_level_ids
            for idx, th in enumerate(first_header.find_all("th")):
                if idx < len(future_first_level_ids):
                    th['data-id'] = json.dumps([future_first_level_ids[idx]]) # forced to add brackets to get a list and not a simple string

            # Second header row: assign id from future_second_level_ids
            for idx, th in enumerate(second_header.find_all("th")):
                if idx < len(future_second_level_ids):
                    first, second = future_second_level_ids[idx]
                    th['data-id'] = json.dumps(future_second_level_ids[idx])

            # Third header row: assign id from future_third_level_ids
            for idx, th in enumerate(third_header.find_all("th")):
                if idx < len(future_third_level_ids):
                    first, second, third = future_third_level_ids[idx]
                    th['data-id'] = json.dumps(future_third_level_ids[idx])

            # add delete buttons for columns
            third_header = header_rows[2]
            ths = third_header.find_all("th")
            for idx, th in enumerate(ths):
                # No attribute for first level header

                col_name = tuple(json.loads(th.get("data-id")))
                
                # Skip the index column and action columns
                if col_name and col_name not in ColNotToShow and col_name != ("index", "", ""):
                    th.append(soup.new_tag("br"))  # Add a line break before the button
                    th.append(soup.new_string(""))
                    btn = soup.new_tag(
                        "button",
                        **{
                            "class": "btn btn-danger btn-sm ms-2",
                            "type": "button",
                            "onclick": f"deleteColumn({json.dumps(col_name)})"
                        }
                    )
                    btn.string = "Supprimer"
                    th.append(btn)

        for row in table.find_all("tr")[3:]:
            details_td = soup.new_tag("td") # Cell for "détails" button
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
            details_td.append(button)
            row.append(details_td)

            del_td = soup.new_tag("td") # cell for "supprimer" button
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

            label_td = soup.new_tag("td") # Cell for "étiquettes" button
            
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

def get_column_names(df, full=True): # the full argument doesn't make sense anymore, I keep it while debugging. Actually the whole function should be obsolete
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

def row_columns_to_dict(df, rowID, columns): #convert to dictionnary for the "détails" modal to show
    if df is not None:
        idx = df.index[int(rowID)]
        details = {}
        for col in columns:
            value = df.at[idx, col]
            # Convert pandas Timestamp to string
            if hasattr(value, 'isoformat'):
                value = value.isoformat()
            # Replace NaN with None (will be serialized as null in JSON)
            if pd.isna(value):
                value = "Non renseigné"
            details[col] = value

        return details
    return {}

def delete_column(df, column_name):
    if df is not None:
        df = df.drop(columns=column_name, errors='ignore')
    return df

def add_column(df, request):
    col_name_1 = request.form.get('column_name_1')
    col_name_2 = request.form.get('column_name_2')
    col_name_3 = request.form.get('column_name_3')
    df[(col_name_1, col_name_2, col_name_3)] = ""
    
    return df

def get_unique_values(df, column):
    if df is not None and column in df.columns:
        return [val for val in df[column].dropna().unique().tolist() if val != ""]
    return []


def df_to_xlsx(df, filename):
    if df is not None:
        output = BytesIO()
        # If DataFrame has MultiIndex columns, write with headers
        if isinstance(df.columns, pd.MultiIndex):
            df.to_excel(output, index=True)
        else:
            df.to_excel(output, index=False)
        output.seek(0)
        return output
    