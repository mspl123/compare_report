const sqlite3 = require('sqlite3').verbose();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const multer = require('multer');
const fs = require('fs');
const { PDFDocument } = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit');
const ExcelJS = require('exceljs');
const path = require('path'); // Import the 'path' module
// Assuming excelProcessor exports the required processExcelFile function
const excelProcessor = require('./excelProcessor');

const app = express();
app.use(cors());
const pdfMake = require('pdfmake/build/pdfmake');
const vfsFonts = require('pdfmake/build/vfs_fonts');

pdfMake.vfs = vfsFonts.pdfMake.vfs;
const bodyParser = require('body-parser');
app.use(bodyParser.json());
app.use(express.json()); // Add this line to parse incoming JSON data
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// SQLite database initialization
const db = new sqlite3.Database('transaction_api_comparison_new.db');

// Function to insert data into the pravah_data table
const insertPravahData = (eachRow) => {
    const checkQuery = 'SELECT COUNT(*) AS count FROM mapping_table WHERE dam_id = ?';
    db.get(checkQuery, [eachRow.dam_id], (checkError, result) => {
        if (checkError) {
            console.log('Error checking dam_id in mapping_table:', checkError);
            return;
        }
        if (result.count > 0) {
            //console.log("found 1");
            db.run(
                'INSERT OR REPLACE INTO pravah_data (dam_name, lake_level, level_reading_date, dam_id) VALUES (?, ?, ?, ?)',
                [eachRow.dam_name, eachRow.lake_level, eachRow.level_reading_date, eachRow.dam_id],
                (err) => {
                    if (err) {
                        console.error('Error inserting data into pravah_data:', err);
                    } else {
                       
                    }
                }
            );
        }
    });
};

// Function to insert data into the api_data table
const insertApiData = (eachRow) => {
    //console.log(eachRow)
    const selectQuery = `SELECT remote_station_id FROM mapping_table where dam_id=?`;

    db.get(selectQuery, [eachRow.dam_id.toString()], (err, result) => {
        if (err) {
            console.error('Error retrieving data from mapping_table:', err);
            return;
        }

        if (result) {
            const remoteStationId = result.remote_station_id;
            //console.log(remoteStationId);

            const checkQuery = 'SELECT COUNT(*) AS count FROM mapping_table WHERE remote_station_id = ?';
            db.get(checkQuery, [remoteStationId], async (checkError, result) => {
                if (checkError) {
                    console.log('Error checking remote_station_id in mapping_table:', checkError);
                    return;
                }
                if (result.count > 0) {
                    const apiUrl = `http://103.224.243.31/API/API_NHP_Pravah.aspx?RemoteStationId=${remoteStationId}`;

                    try {
                        const response = await axios.get(apiUrl);
                        const jsonRegex = /\{.*\}/;
                        const jsonMatch = response.data.match(jsonRegex);

                        if (jsonMatch) {
                            const jsonString = jsonMatch[0];
                            try {
                                const jsonData = JSON.parse(jsonString);
                                db.run(
                                    'INSERT OR REPLACE INTO api_data (mst_remote_station_id, mst_remote_station_name, date1, time1, mst_level) VALUES (?, ?, ?, ?, ?)',
                                    [jsonData.mst_remote_station_id, jsonData.mst_remote_station_name, jsonData.date1, jsonData.time1, jsonData.mst_level],
                                    (err) => {
                                        if (err) {
                                            console.error('Error inserting data into api_data:', err);
                                        } else {
                                            //console.log('Data inserted into api_data successfully.');
                                        }
                                    }
                                );
                                
                                //console.log(jsonData);
                            } catch (error) {
                                console.error('Error parsing JSON:', error);
                            }
                        } else {
                            console.error('No JSON data found in the response.');
                        }
                        // Assuming you have a function to handle the API response and store data
                    } catch (apiError) {
                        console.error(`Error calling API for remote_station_id ${remoteStationId}:`, apiError.message);
                    }

              
                }
            });
        }
    
    })}

const add_stations = (Row) => {
    console.log("row   :" + Row.mst_remote_station_id);
    const checkQuery = 'SELECT COUNT(*) AS count FROM mapping_table WHERE remote_station_id = ?';

    return new Promise((resolve, reject) => {
        db.get(checkQuery, [Row.mst_remote_station_id], (checkError, result) => {
            if (checkError) {
                console.error('Error checking remote_station_id in mapping_table:', checkError);
                reject('Error checking remote_station_id in mapping_table');
                return;
            }

            if (result.count === 0) {
                db.run(
                    'INSERT INTO mapping_table (remote_station_id, dam_id) VALUES (?, ?)',
                    [Row.mst_remote_station_id.toString(), Row.dam_id.toString()],
                    (err) => {
                        if (err) {
                            console.error('Error inserting data into mapping_table:', err);
                            reject('Error inserting data into mapping_table');
                        } else {
                            console.log('Data inserted into mapping_table successfully.');
                            resolve('Data inserted into mapping_table successfully.');
                        }
                    }
                );
            } else {
                const errorMessage = "Primary key conflict, damid exists";
                console.log(errorMessage);
                reject(errorMessage);
            }
        });
    });
};

// Function to prepare the PDF view
const prepare_view_pdf = () => {
    return new Promise(async (resolve, reject) => {
    const selectQuery = `
    SELECT *, ROUND(pravah_data.lake_level - api_data.mst_level, 2) as level_difference    
    FROM mapping_table
    INNER JOIN api_data ON mapping_table.remote_station_id = api_data.mst_remote_station_id
    INNER JOIN pravah_data ON mapping_table.dam_id = pravah_data.dam_id
`;
try {
    const rows = await new Promise((dbResolve, dbReject) => {
    db.all(selectQuery, [], (err, rows) => {
        if (err) {
            console.error('Error retrieving data:', err);
            dbReject(err);
            return;
        }else{
            dbResolve(rows);
        }

        // Create an array to store the PDF content
        const pdfContent = [];

        // Define table headers
        const tableHeaders = ['Pravah Dam Name','Dam ID', 'MST Remote Station Name','MST Remote Station ID', 'Pravah Level Reading Date',  'API Date', 'API Time', 'Pravah Lake Level', 'API MST Level', 'Level Difference'];

        pdfContent.push(tableHeaders);

        // Add rows to the PDF content
        rows.forEach(row => {
            const rowData = [
                { text: row.dam_name, fontSize: 10 },
                { text: row.dam_id, fontSize: 10 },             
              
                { text: row.mst_remote_station_name, fontSize: 10 },
                { text: row.mst_remote_station_id, fontSize: 10 },
                { text: row.level_reading_date, fontSize: 10 },
                { text: row.date1, fontSize: 10 },
                { text: row.time1, fontSize: 10 },
                { text: row.lake_level, fontSize: 10 },
                { text: row.mst_level, fontSize: 10 },
                { text: row.level_difference, fontSize: 10 }
            ];

            pdfContent.push(rowData);
        });

        // Create a PDF document with decreased font size
        const documentDefinition = {
            content: [
                {
                    table: {
                        headerRows: 1,
                        body: pdfContent,
                        fontSize: 10, // Set the desired font size
                        widths: [60, 40, 50, 40, 60, 40, 40, 30, 30, 30], // Adjust 
                    },
                },
            ],
          
        };

        // Generate PDF
        const pdfFilePath = path.join(__dirname, 'client', 'output.pdf');
        try {
            fs.unlinkSync(pdfFilePath);
            console.log('Existing PDF file deleted successfully.');
        } catch (err) {
            // Ignore errors if the file doesn't exist
            if (err.code !== 'ENOENT') {
                console.error('Error deleting existing PDF file:', err);
                return;
            }
        }
        const pdfDoc = pdfMake.createPdf(documentDefinition);
        pdfDoc.getBuffer((buffer) => {
            fs.writeFileSync(pdfFilePath, buffer);
            console.log('PDF generated successfully. Check output.pdf');
        });
    });
});
resolve({ success: true, message: 'PDF generated successfully.' });

// Rest of your code...
} catch (error) {
console.error('An error occurred:', error);
}
});
};

const prepare_view_excel = async () => {
    console.log("hello here inside exce");
    const selectQuery = `
        SELECT *, ROUND(pravah_data.lake_level - api_data.mst_level, 2) as level_difference    
        FROM mapping_table
        INNER JOIN api_data ON mapping_table.remote_station_id = api_data.mst_remote_station_id
        INNER JOIN pravah_data ON mapping_table.dam_id = pravah_data.dam_id
    `;

    try {
        const rows = await new Promise((resolve, reject) => {
            db.all(selectQuery, [], (err, rows) => {
                if (err) {
                    console.error('Error retrieving data:', err);
                    reject(err);
                    return;
                }

                // Create a workbook and add a worksheet
                const workbook = new ExcelJS.Workbook();
                const worksheet = workbook.addWorksheet('Sheet 1');

                // Define column headers
                const tableHeaders = ['Dam Name', 'Dam ID', 'MST Remote Station Name', 'MST Remote Station ID', 'Pravah Level Reading Date', 'API MST_Date', 'API MST_Time', 'Pravah Lake Level', ' API MST Level', 'Level Difference'];

                // Add headers to the worksheet
                const headerRow = worksheet.addRow(tableHeaders);
                headerRow.eachCell((cell, colNumber) => {
                    let columnWidth = 15;
                    if (colNumber === 1 || colNumber === 3 || colNumber === 5) {
                        columnWidth = 24;
                    }
                    worksheet.getColumn(colNumber).width = columnWidth;
                });

                // Add rows to the worksheet
                rows.forEach(row => {
                    const rowData = [
                        row.dam_name,
                        row.dam_id,
                        row.mst_remote_station_name,
                        row.mst_remote_station_id,
                        row.level_reading_date,
                        row.date1,
                        row.time1,
                        row.lake_level,
                        row.mst_level,
                        row.level_difference
                    ];

                    worksheet.addRow(rowData);
                });

                // Save the workbook to a file
                const excelFilePath = path.join(__dirname, 'client', 'output.xlsx');
                try {
                    fs.unlinkSync(excelFilePath);
                    console.log('Existing excel file deleted successfully.');
                } catch (err) {
                    if (err.code !== 'ENOENT') {
                        console.error('Error deleting existing excel file:', err);
                        reject(err);
                        return;
                    }
                }

                workbook.xlsx.writeFile(excelFilePath)
                    .then(() => {
                        console.log(`Excel file generated successfully. Check ${excelFilePath}`);
                        resolve('yes from excel');
                    })
                    .catch(error => {
                        console.error('Error generating Excel file:', error);
                        reject(error);
                    });
            });
        });

        return 'yes from excel';

    } catch (error) {
        console.error('An error occurred:', error);
        throw error;
    }
};

// Usage


//API endpoint for inserting data into tables
app.post('/insertData', async (req, res) => {
    try {
        console.log(req.body.mst_remote_station_id);
        // Insert data into mapping_table
        const resultMessage = await add_stations(req.body);

        // Insert data into other tables if needed

        res.status(200).json({ message: resultMessage });
    } catch (error) {
        console.error('An error occurred in the route handler:', error);
        res.json({ message: 'primary key conflict' });
    }
});


//API endpoint for file upload


app.post('/upload', upload.single('xlsxFile'), async (req, res) => {
    const uploadedFile = req.file;
    console.log('Request received at /upload');

    if (!uploadedFile) {
       res.json({ message: 'No file uploaded.' });
    }

    console.log('Received XLSX file:', uploadedFile.originalname);

    // Generate PDF and Excel files
    const pdfFilePath = path.join(__dirname, 'client', 'output.pdf');
    const excelFilePath = path.join(__dirname, 'client', 'output.xlsx');

    try {
        // Call the processExcelFile function from the imported module
        const filteredRowsData = await new Promise((resolve, reject) => {
            excelProcessor.processExcelFile(uploadedFile, (data) => {
                if (data) {
                    resolve(data);
                } else {
                    reject('Error processing Excel file.');
                }
            });
        });

        // You can now work with the filtered data
        filteredRowsData.forEach((eachRow) => {
            // Insert data into pravah_data table
            insertPravahData(eachRow);

            // Insert data into api_data table
            insertApiData(eachRow);
        });

        // Fetch data for PDF view after both tables are ready
        const selectQuery = `
            SELECT *       
            FROM mapping_table
            INNER JOIN api_data ON mapping_table.remote_station_id = api_data.mst_remote_station_id
            INNER JOIN pravah_data ON mapping_table.dam_id = pravah_data.dam_id
        `;

        db.all(selectQuery, [], async (err, rows) => {
            if (err) {
                console.error('Error retrieving data:', err);
                res.json({ message: 'Internal Server Error' });
            }

        

            try {
                const response = await prepare_view_excel();
                console.log('Server response:', response);
                res.json({ message: 'after excel client'})
                // Send a response with download links
                
            } catch (excelError) {
                console.error('Error preparing Excel file:', excelError);
            }

            console.log('before pdf');
            try {
                const response = await prepare_view_pdf();
                console.log('response from pdf function:', response);
                res.json({ message: 'Successful pdf'})
                // Send a response with download links
              
               
            } catch (excelError) {
                console.error('Error preparing Excel file:', excelError);
            }
          
        });
       
   
    } catch (error) {
        console.error('An error occurred:', error);
        res.json({ message: 'Internal Server Error' });
   
    }

});




const port = 3000;
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
