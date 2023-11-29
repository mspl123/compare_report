const XLSX = require('xlsx');

const processExcelFile = (uploadedFile, callback) => {
    const data = uploadedFile.buffer;
    const workbook = XLSX.read(data, { type: "buffer" });

    // Assuming the first sheet is the one you want to read (index 0).
    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    // Initialize an array to store filtered rows as objects.
    const filteredRowsData = [];

    // Get the range of cells in the sheet.
    const range = XLSX.utils.decode_range(sheet['!ref']);

    for (let row = range.s.r; row <= range.e.r; row++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: 21 }); // Column 22 (0-based index)

        // Check if the cell in column 22 contains "Medium" or "Major"
        if (sheet[cellAddress] && (sheet[cellAddress].v === "Medium" || sheet[cellAddress].v === "Major")) {
            // Initialize an object to store the data for the first, third, and fourth columns
            const rowData = {};

            const firstColumnAddress = XLSX.utils.encode_cell({ r: row, c: 0 }); // First Column (0-based index)
            const firstColumnValue = sheet[firstColumnAddress] ? sheet[firstColumnAddress].v: undefined;

            const thirdColumnAddress = XLSX.utils.encode_cell({ r: row, c: 2 }); // Third Column (0-based index)
            const thirdColumnValue = sheet[thirdColumnAddress] ? sheet[thirdColumnAddress].v : undefined;

            const fourthColumnAddress = XLSX.utils.encode_cell({ r: row, c: 3 }); // Fourth Column (0-based index)
            const fourthColumnValue = sheet[fourthColumnAddress] ? sheet[fourthColumnAddress].v : undefined;

            const fortysixthColumnAddress = XLSX.utils.encode_cell({ r: row, c: 45 }); // 46th Column (0-based index)
            const fortysixColumnValue = sheet[fortysixthColumnAddress] ? sheet[fortysixthColumnAddress].v : undefined;

            rowData["dam_name"] = firstColumnValue;
            rowData["lake_level"] = thirdColumnValue;
            rowData["level_reading_date"] = fourthColumnValue;
            rowData["dam_id"] = fortysixColumnValue;
            filteredRowsData.push(rowData);
        }
    }

    // Call the callback function provided from app.js with the filtered data
    callback(filteredRowsData);
};

module.exports = {
    processExcelFile,
};
