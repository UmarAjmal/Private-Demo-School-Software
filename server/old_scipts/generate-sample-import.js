const XLSX = require('xlsx');

// Template object with all required fields
const template = {
    admission_no: 'AUTO',
    admission_date: '2026-02-17',
    first_name: '',
    last_name: '',
    gender: '',
    dob: '',
    cnic_bform: '',
    class_name: 'Class 1',
    section_name: 'Blue',
    roll_no: '',
    category: 'Normal',
    student_mobile: '',
    email: '',
    city: 'Karachi',
    current_address: '',
    permanent_address: '',
    father_name: '',
    father_phone: '',
    father_cnic: '',
    father_occupation: '',
    mother_name: '',
    mother_phone: '',
    mother_cnic: '',
    mother_occupation: '',
    guardian_name: '',
    guardian_relation: 'Father',
    guardian_phone: '',
    guardian_cnic: '',
    guardian_address: '',
    religion: 'Islam',
    blood_group: '',
    monthly_fee: 5000,
    admission_fee: 2000
};

// Sample students - 20 students with 3 families having siblings
const students = [
    // Family 1: Ahmed & Ali (Brothers - same father_cnic)
    { ...template, roll_no: '101', first_name: 'Ahmed', last_name: 'Khan', gender: 'Male', dob: '2016-03-15', student_mobile: '03001234501', email: 'ahmed.khan@example.com', current_address: 'House 123, Block A, Gulshan', permanent_address: 'House 123, Block A, Gulshan', father_name: 'Muhammad Asif Khan', father_phone: '03211234501', father_cnic: '42201-1234567-1', father_occupation: 'Engineer', mother_name: 'Fatima Khan', mother_phone: '03331234501', mother_cnic: '42202-1234567-2', mother_occupation: 'Teacher', guardian_name: 'Muhammad Asif Khan', guardian_phone: '03211234501', guardian_cnic: '42201-1234567-1', guardian_address: 'House 123, Block A, Gulshan', blood_group: 'B+' },
    
    { ...template, roll_no: '102', first_name: 'Ali', last_name: 'Khan', gender: 'Male', dob: '2017-07-20', student_mobile: '03001234502', email: 'ali.khan@example.com', current_address: 'House 123, Block A, Gulshan', permanent_address: 'House 123, Block A, Gulshan', father_name: 'Muhammad Asif Khan', father_phone: '03211234501', father_cnic: '42201-1234567-1', father_occupation: 'Engineer', mother_name: 'Fatima Khan', mother_phone: '03331234501', mother_cnic: '42202-1234567-2', mother_occupation: 'Teacher', guardian_name: 'Muhammad Asif Khan', guardian_phone: '03211234501', guardian_cnic: '42201-1234567-1', guardian_address: 'House 123, Block A, Gulshan', blood_group: 'B+' },

    // Family 2: Sara & Ayesha (Sisters - same father_cnic)
    { ...template, roll_no: '103', first_name: 'Sara', last_name: 'Ahmed', gender: 'Female', dob: '2016-05-10', student_mobile: '03001234503', email: 'sara.ahmed@example.com', current_address: 'Flat 45, DHA Phase 5', permanent_address: 'Flat 45, DHA Phase 5', father_name: 'Hassan Ahmed', father_phone: '03211234502', father_cnic: '42201-2345678-1', father_occupation: 'Doctor', mother_name: 'Aisha Ahmed', mother_phone: '03331234502', mother_cnic: '42202-2345678-2', mother_occupation: 'Housewife', guardian_name: 'Hassan Ahmed', guardian_phone: '03211234502', guardian_cnic: '42201-2345678-1', guardian_address: 'Flat 45, DHA Phase 5', blood_group: 'A+' },
    
    { ...template, roll_no: '104', first_name: 'Ayesha', last_name: 'Ahmed', gender: 'Female', dob: '2017-09-25', student_mobile: '03001234504', email: 'ayesha.ahmed@example.com', current_address: 'Flat 45, DHA Phase 5', permanent_address: 'Flat 45, DHA Phase 5', father_name: 'Hassan Ahmed  ', father_phone: '03211234502', father_cnic: '42201-2345678-1', father_occupation: 'Doctor', mother_name: 'Aisha Ahmed', mother_phone: '03331234502', mother_cnic: '42202-2345678-2', mother_occupation: 'Housewife', guardian_name: 'Hassan Ahmed', guardian_phone: '03211234502', guardian_cnic: '42201-2345678-1', guardian_address: 'Flat 45, DHA Phase 5', blood_group: 'A+' },

    // Family 3: Usman, Bilal & Zainab (3 Siblings - same father_cnic)
    { ...template, roll_no: '105', first_name: 'Usman', last_name: 'Malik', gender: 'Male', dob: '2016-01-12', student_mobile: '03001234505', email: 'usman.malik@example.com', current_address: 'House 67, Clifton', permanent_address: 'House 67, Clifton', father_name: 'Tariq Malik', father_phone: '03211234503', father_cnic: '42201-3456789-1', father_occupation: 'Businessman', mother_name: 'Nadia Malik', mother_phone: '03331234503', mother_cnic: '42202-3456789-2', mother_occupation: 'Lawyer', guardian_name: 'Tariq Malik', guardian_phone: '03211234503', guardian_cnic: '42201-3456789-1', guardian_address: 'House 67, Clifton', blood_group: 'O+' },
    
    { ...template, roll_no: '106', first_name: 'Bilal', last_name: 'Malik', gender: 'Male', dob: '2016-11-30', student_mobile: '03001234506', email: 'bilal.malik@example.com', current_address: 'House 67, Clifton', permanent_address: 'House 67, Clifton', father_name: 'Tariq Malik', father_phone: '03211234503', father_cnic: '42201-3456789-1', father_occupation: 'Businessman', mother_name: 'Nadia Malik', mother_phone: '03331234503', mother_cnic: '42202-3456789-2', mother_occupation: 'Lawyer', guardian_name: 'Tariq Malik', guardian_phone: '03211234503', guardian_cnic: '42201-3456789-1', guardian_address: 'House 67, Clifton', blood_group: 'O+' },
    
    { ...template, roll_no: '107', first_name: 'Zainab', last_name: 'Malik', gender: 'Female', dob: '2017-04-18', student_mobile: '03001234507', email: 'zainab.malik@example.com', current_address: 'House 67, Clifton', permanent_address: 'House 67, Clifton', father_name: 'Tariq Malik', father_phone: '03211234503', father_cnic: '42201-3456789-1', father_occupation: 'Businessman', mother_name: 'Nadia Malik', mother_phone: '03331234503', mother_cnic: '42202-3456789-2', mother_occupation: 'Lawyer', guardian_name: 'Tariq Malik', guardian_phone: '03211234503', guardian_cnic: '42201-3456789-1', guardian_address: 'House 67, Clifton', blood_group: 'O+' },

    // Single students (13 more - no siblings)
    { ...template, roll_no: '108', first_name: 'Haris', last_name: 'Raza', gender: 'Male', dob: '2016-08-22', student_mobile: '03001234508', email: 'haris.raza@example.com', current_address: 'Apartment 12, North Nazimabad', permanent_address: 'Apartment 12, North Nazimabad', father_name: 'Imran Raza', father_phone: '03211234504', father_cnic: '42201-4567890-1', father_occupation: 'Accountant', mother_name: 'Sadia Raza', mother_phone: '03331234504', mother_cnic: '42202-4567890-2', mother_occupation: 'Banker', guardian_name: 'Imran Raza', guardian_phone: '03211234504', guardian_cnic: '42201-4567890-1', guardian_address: 'Apartment 12, North Nazimabad', blood_group: 'AB+' },

    { ...template, roll_no: '109', first_name: 'Maryam', last_name: 'Siddiqui', gender: 'Female', dob: '2016-12-05', student_mobile: '03001234509', email: 'maryam.siddiqui@example.com', current_address: 'House 89, Shahrah-e-Faisal', permanent_address: 'House 89, Shahrah-e-Faisal', father_name: 'Shahid Siddiqui', father_phone: '03211234505', father_cnic: '42201-5678901-1', father_occupation: 'Pilot', mother_name: 'Sana Siddiqui', mother_phone: '03331234505', mother_cnic: '42202-5678901-2', mother_occupation: 'Architect', guardian_name: 'Shahid Siddiqui', guardian_phone: '03211234505', guardian_cnic: '42201-5678901-1', guardian_address: 'House 89, Shahrah-e-Faisal', blood_group: 'A-' },

    { ...template, roll_no: '110', first_name: 'Faisal', last_name: 'Hussain', gender: 'Male', dob: '2017-02-14', student_mobile: '03001234510', email: 'faisal.hussain@example.com', current_address: 'Villa 23, Bahria Town', permanent_address: 'Villa 23, Bahria Town', father_name: 'Kamran Hussain', father_phone: '03211234506', father_cnic: '42201-6789012-1', father_occupation: 'Software Engineer', mother_name: 'Hina Hussain', mother_phone: '03331234506', mother_cnic: '42202-6789012-2', mother_occupation: 'Designer', guardian_name: 'Kamran Hussain', guardian_phone: '03211234506', guardian_cnic: '42201-6789012-1', guardian_address: 'Villa 23, Bahria Town', blood_group: 'B-' },

    { ...template, roll_no: '111', first_name: 'Hamza', last_name: 'Iqbal', gender: 'Male', dob: '2016-06-30', student_mobile: '03001234511', email: 'hamza.iqbal@example.com', current_address: 'House 34, PECHS', permanent_address: 'House 34, PECHS', father_name: 'Jalal Iqbal', father_phone: '03211234507', father_cnic: '42201-7890123-1', father_occupation: 'Manager', mother_name: 'Bushra Iqbal', mother_phone: '03331234507', mother_cnic: '42202-7890123-2', mother_occupation: 'Pharmacist', guardian_name: 'Jalal Iqbal', guardian_phone: '03211234507', guardian_cnic: '42201-7890123-1', guardian_address: 'House 34, PECHS', blood_group: 'O-' },

    { ...template, roll_no: '112', first_name: 'Zara', last_name: 'Noor', gender: 'Female', dob: '2017-10-08', student_mobile: '03001234512', email: 'zara.noor@example.com', current_address: 'Flat 78, Malir Cantt', permanent_address: 'Flat 78, Malir Cantt', father_name: 'Noor Ahmed', father_phone: '03211234508', father_cnic: '42201-8901234-1', father_occupation: 'Army Officer', mother_name: 'Rabia Noor', mother_phone: '03331234508', mother_cnic: '42202-8901234-2', mother_occupation: 'Nurse', guardian_name: 'Noor Ahmed', guardian_phone: '03211234508', guardian_cnic: '42201-8901234-1', guardian_address: 'Flat 78, Malir Cantt', blood_group: 'AB-' },

    { ...template, roll_no: '113', first_name: 'Ibrahim', last_name: 'Sheikh', gender: 'Male', dob: '2016-04-17', student_mobile: '03001234513', email: 'ibrahim.sheikh@example.com', current_address: 'House 56, Korangi', permanent_address: 'House 56, Korangi', father_name: 'Farooq Sheikh', father_phone: '03211234509', father_cnic: '42201-9012345-1', father_occupation: 'Shopkeeper', mother_name: 'Maryam Sheikh', mother_phone: '03331234509', mother_cnic: '42202-9012345-2', mother_occupation: 'Tailor', guardian_name: 'Farooq Sheikh', guardian_phone: '03211234509', guardian_cnic: '42201-9012345-1', guardian_address: 'House 56, Korangi', blood_group: 'B+' },

    { ...template, roll_no: '114', first_name: 'Mahnoor', last_name: 'Farhan', gender: 'Female', dob: '2017-08-11', student_mobile: '03001234514', email: 'mahnoor.farhan@example.com', current_address: 'Apartment 9, Saddar', permanent_address: 'Apartment 9, Saddar', father_name: 'Farhan Malik', father_phone: '03211234510', father_cnic: '42201-0123456-1', father_occupation: 'Chef', mother_name: 'Saima Farhan', mother_phone: '03331234510', mother_cnic: '42202-0123456-2', mother_occupation: 'Artist', guardian_name: 'Farhan Malik', guardian_phone: '03211234510', guardian_cnic: '42201-0123456-1', guardian_address: 'Apartment 9, Saddar', blood_group: 'A+' },

    { ...template, roll_no: '115', first_name: 'Yasir', last_name: 'Yousuf', gender: 'Male', dob: '2016-09-28', student_mobile: '03001234515', email: 'yasir.yousuf@example.com', current_address: 'House 101, Landhi', permanent_address: 'House 101, Landhi', father_name: 'Yousuf Ali', father_phone: '03211234511', father_cnic: '42201-1122334-1', father_occupation: 'Driver', mother_name: 'Khadija Yousuf', mother_phone: '03331234515', mother_cnic: '42202-1122334-2', mother_occupation: 'Housewife', guardian_name: 'Yousuf Ali', guardian_phone: '03211234511', guardian_cnic: '42201-1122334-1', guardian_address: 'House 101, Landhi', blood_group: 'O+' },

    { ...template, roll_no: '116', first_name: 'Fatima', last_name: 'Zahra', gender: 'Female', dob: '2017-03-19', student_mobile: '03001234516', email: 'fatima.zahra@example.com', current_address: 'Flat 45, FB Area', permanent_address: 'Flat 45, FB Area', father_name: 'Zahra Abbas', father_phone: '03211234512', father_cnic: '42201-2233445-1', father_occupation: 'Electrician', mother_name: 'Amina Zahra', mother_phone: '03331234512', mother_cnic: '42202-2233445-2', mother_occupation: 'Cook', guardian_name: 'Zahra Abbas', guardian_phone: '03211234512', guardian_cnic: '42201-2233445-1', guardian_address: 'Flat 45, FB Area', blood_group: 'B+' },

    { ...template, roll_no: '117', first_name: 'Danial', last_name: 'Hassan', gender: 'Male', dob: '2016-11-03', student_mobile: '03001234517', email: 'danial.hassan@example.com', current_address: 'House 22, Johar', permanent_address: 'House 22, Johar', father_name: 'Hassan Raza', father_phone: '03211234513', father_cnic: '42201-3344556-1', father_occupation: 'Mechanic', mother_name: 'Zainab Hassan', mother_phone: '03331234513', mother_cnic: '42202-3344556-2', mother_occupation: 'Teacher', guardian_name: 'Hassan Raza', guardian_phone: '03211234513', guardian_cnic: '42201-3344556-1', guardian_address: 'House 22, Johar', blood_group: 'A+' },

    { ...template, roll_no: '118', first_name: 'Hira', last_name: 'Naveed', gender: 'Female', dob: '2017-05-27', student_mobile: '03001234518', email: 'hira.naveed@example.com', current_address: 'Villa 8, Scheme 33', permanent_address: 'Villa 8, Scheme 33', father_name: 'Naveed Akhtar', father_phone: '03211234514', father_cnic: '42201-4455667-1', father_occupation: 'Trader', mother_name: 'Saira Naveed', mother_phone: '03331234514', mother_cnic: '42202-4455667-2', mother_occupation: 'Social Worker', guardian_name: 'Naveed Akhtar', guardian_phone: '03211234514', guardian_cnic: '42201-4455667-1', guardian_address: 'Villa 8, Scheme 33', blood_group: 'O+' },

    { ...template, roll_no: '119', first_name: 'Rayan', last_name: 'Baig', gender: 'Male', dob: '2016-07-15', student_mobile: '03001234519', email: 'rayan.baig@example.com', current_address: 'Apartment 33, Liaquatabad', permanent_address: 'Apartment 33, Liaquatabad', father_name: 'Baig Ahmed', father_phone: '03211234515', father_cnic: '42201-5566778-1', father_occupation: 'Plumber', mother_name: 'Nazia Baig', mother_phone: '03331234515', mother_cnic: '42202-5566778-2', mother_occupation: 'Beautician', guardian_name: 'Baig Ahmed', guardian_phone: '03211234515', guardian_cnic: '42201-5566778-1', guardian_address: 'Apartment 33, Liaquatabad', blood_group: 'AB+' },

    { ...template, roll_no: '120', first_name: 'Anum', last_name: 'Waqas', gender: 'Female', dob: '2017-01-21', student_mobile: '03001234520', email: 'anum.waqas@example.com', current_address: 'House 77, Orangi Town', permanent_address: 'House 77, Orangi Town', father_name: 'Waqas Haider', father_phone: '03211234516', father_cnic: '42201-6677889-1', father_occupation: 'Salesman', mother_name: 'Shumaila Waqas', mother_phone: '03331234516', mother_cnic: '42202-6677889-2', mother_occupation: 'Housewife', guardian_name: 'Waqas Haider', guardian_phone: '03211234516', guardian_cnic: '42201-6677889-1', guardian_address: 'House 77, Orangi Town', blood_group: 'B-' }
];

// Create workbook and worksheet
const ws = XLSX.utils.json_to_sheet(students);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Students");

// Write to file
XLSX.writeFile(wb, "Sample_Import_20_Students.xlsx");

console.log("✅ Excel file generated: Sample_Import_20_Students.xlsx");
console.log(`📊 Total Students: ${students.length}`);
console.log("👨‍👩‍👧‍👦 Families included:");
console.log("  - Family 1: Ahmed & Ali Khan (2 brothers - same CNIC)");
console.log("  - Family 2: Sara & Ayesha Ahmed (2 sisters - same CNIC)");
console.log("  - Family 3: Usman, Bilal & Zainab Malik (3 siblings - same CNIC)");
console.log("  - 13 Single students (no siblings in this import)");
console.log("");
console.log("🎯 Test Auto-Linking:");
console.log("  - Import this file to Students -> Import Students");
console.log("  - System will auto-detect 3 families by Father CNIC");
console.log("  - Expected: 7 students linked, 13 new families");
