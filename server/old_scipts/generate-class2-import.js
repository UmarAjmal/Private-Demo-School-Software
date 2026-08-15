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
    class_name: 'Class 2',
    section_name: 'Red',
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

// Class 2 Students - 20 students
// Including SIBLINGS from Class 1 families & COUSINS for manual linking test
const students = [
    // ========================================
    // SIBLINGS: Same father_cnic as Class 1 students (Auto-linking test)
    // ========================================
    
    // Sibling of Ahmed & Ali Khan (Class 1) - SAME father_cnic
    { ...template, roll_no: '201', first_name: 'Hassan', last_name: 'Khan', gender: 'Male', dob: '2015-02-10', student_mobile: '03001234601', email: 'hassan.khan@example.com', current_address: 'House 123, Block A, Gulshan', permanent_address: 'House 123, Block A, Gulshan', father_name: 'Muhammad Asif Khan', father_phone: '03211234501', father_cnic: '42201-1234567-1', father_occupation: 'Engineer', mother_name: 'Fatima Khan', mother_phone: '03331234501', mother_cnic: '42202-1234567-2', mother_occupation: 'Teacher', guardian_name: 'Muhammad Asif Khan', guardian_phone: '03211234501', guardian_cnic: '42201-1234567-1', guardian_address: 'House 123, Block A, Gulshan', blood_group: 'B+' },
    
    // Sibling of Sara & Ayesha Ahmed (Class 1) - SAME father_cnic
    { ...template, roll_no: '202', first_name: 'Maria', last_name: 'Ahmed', gender: 'Female', dob: '2015-08-14', student_mobile: '03001234602', email: 'maria.ahmed@example.com', current_address: 'Flat 45, DHA Phase 5', permanent_address: 'Flat 45, DHA Phase 5', father_name: 'Hassan Ahmed', father_phone: '03211234502', father_cnic: '42201-2345678-1', father_occupation: 'Doctor', mother_name: 'Aisha Ahmed', mother_phone: '03331234502', mother_cnic: '42202-2345678-2', mother_occupation: 'Housewife', guardian_name: 'Hassan Ahmed', guardian_phone: '03211234502', guardian_cnic: '42201-2345678-1', guardian_address: 'Flat 45, DHA Phase 5', blood_group: 'A+' },
    
    // Sibling of Usman, Bilal & Zainab Malik (Class 1) - SAME father_cnic
    { ...template, roll_no: '203', first_name: 'Umer', last_name: 'Malik', gender: 'Male', dob: '2015-06-22', student_mobile: '03001234603', email: 'umer.malik@example.com', current_address: 'House 67, Clifton', permanent_address: 'House 67, Clifton', father_name: 'Tariq Malik', father_phone: '03211234503', father_cnic: '42201-3456789-1', father_occupation: 'Businessman', mother_name: 'Nadia Malik', mother_phone: '03331234503', mother_cnic: '42202-3456789-2', mother_occupation: 'Lawyer', guardian_name: 'Tariq Malik', guardian_phone: '03211234503', guardian_cnic: '42201-3456789-1', guardian_address: 'House 67, Clifton', blood_group: 'O+' },

    // ========================================
    // COUSINS: Same last name but DIFFERENT father_cnic (Manual linking test)
    // ========================================
    
    // Cousin of Khan family (Uncle's children - Different father)
    { ...template, roll_no: '204', first_name: 'Fahad', last_name: 'Khan', gender: 'Male', dob: '2015-04-18', student_mobile: '03001234604', email: 'fahad.khan@example.com', current_address: 'House 125, Block B, Gulshan', permanent_address: 'House 125, Block B, Gulshan', father_name: 'Shahzad Ahmed Khan', father_phone: '03211234521', father_cnic: '42201-1234999-1', father_occupation: 'Architect', mother_name: 'Samina Khan', mother_phone: '03331234521', mother_cnic: '42202-1234999-2', mother_occupation: 'Designer', guardian_name: 'Shahzad Ahmed Khan', guardian_phone: '03211234521', guardian_cnic: '42201-1234999-1', guardian_address: 'House 125, Block B, Gulshan', blood_group: 'B+' },
    
    { ...template, roll_no: '205', first_name: 'Sana', last_name: 'Khan', gender: 'Female', dob: '2015-11-25', student_mobile: '03001234605', email: 'sana.khan@example.com', current_address: 'House 125, Block B, Gulshan', permanent_address: 'House 125, Block B, Gulshan', father_name: 'Shahzad Ahmed Khan', father_phone: '03211234521', father_cnic: '42201-1234999-1', father_occupation: 'Architect', mother_name: 'Samina Khan', mother_phone: '03331234521', mother_cnic: '42202-1234999-2', mother_occupation: 'Designer', guardian_name: 'Shahzad Ahmed Khan', guardian_phone: '03211234521', guardian_cnic: '42201-1234999-1', guardian_address: 'House 125, Block B, Gulshan', blood_group: 'B+' },

    // Cousin of Ahmed family (Uncle's children - Different father)
    { ...template, roll_no: '206', first_name: 'Zain', last_name: 'Ahmed', gender: 'Male', dob: '2015-09-30', student_mobile: '03001234606', email: 'zain.ahmed@example.com', current_address: 'Flat 50, DHA Phase 6', permanent_address: 'Flat 50, DHA Phase 6', father_name: 'Imran Ahmed', father_phone: '03211234522', father_cnic: '42201-2345999-1', father_occupation: 'Banker', mother_name: 'Rabia Ahmed', mother_phone: '03331234522', mother_cnic: '42202-2345999-2', mother_occupation: 'Professor', guardian_name: 'Imran Ahmed', guardian_phone: '03211234522', guardian_cnic: '42201-2345999-1', guardian_address: 'Flat 50, DHA Phase 6', blood_group: 'A-' },

    // Cousin of Malik family (Uncle's children - Different father)
    { ...template, roll_no: '207', first_name: 'Aliya', last_name: 'Malik', gender: 'Female', dob: '2015-12-08', student_mobile: '03001234607', email: 'aliya.malik@example.com', current_address: 'House 70, Clifton', permanent_address: 'House 70, Clifton', father_name: 'Salman Malik', father_phone: '03211234523', father_cnic: '42201-3456999-1', father_occupation: 'Consultant', mother_name: 'Sobia Malik', mother_phone: '03331234523', mother_cnic: '42202-3456999-2', mother_occupation: 'Dentist', guardian_name: 'Salman Malik', guardian_phone: '03211234523', guardian_cnic: '42201-3456999-1', guardian_address: 'House 70, Clifton', blood_group: 'O-' },

    { ...template, roll_no: '208', first_name: 'Arham', last_name: 'Malik', gender: 'Male', dob: '2015-03-17', student_mobile: '03001234608', email: 'arham.malik@example.com', current_address: 'House 70, Clifton', permanent_address: 'House 70, Clifton', father_name: 'Salman Malik', father_phone: '03211234523', father_cnic: '42201-3456999-1', father_occupation: 'Consultant', mother_name: 'Sobia Malik', mother_phone: '03331234523', mother_cnic: '42202-3456999-2', mother_occupation: 'Dentist', guardian_name: 'Salman Malik', guardian_phone: '03211234523', guardian_cnic: '42201-3456999-1', guardian_address: 'House 70, Clifton', blood_group: 'O-' },

    // ========================================
    // NEW FAMILIES (No relation to Class 1 students)
    // ========================================
    
    { ...template, roll_no: '209', first_name: 'Ameer', last_name: 'Abbas', gender: 'Male', dob: '2015-07-05', student_mobile: '03001234609', email: 'ameer.abbas@example.com', current_address: 'House 45, Nazimabad', permanent_address: 'House 45, Nazimabad', father_name: 'Ali Abbas', father_phone: '03211234524', father_cnic: '42201-7771111-1', father_occupation: 'Officer', mother_name: 'Hina Abbas', mother_phone: '03331234524', mother_cnic: '42202-7771111-2', mother_occupation: 'Writer', guardian_name: 'Ali Abbas', guardian_phone: '03211234524', guardian_cnic: '42201-7771111-1', guardian_address: 'House 45, Nazimabad', blood_group: 'A+' },

    { ...template, roll_no: '210', first_name: 'Noor', last_name: 'Fatima', gender: 'Female', dob: '2015-10-12', student_mobile: '03001234610', email: 'noor.fatima@example.com', current_address: 'Flat 88, FB Area', permanent_address: 'Flat 88, FB Area', father_name: 'Kamran Ali', father_phone: '03211234525', father_cnic: '42201-8882222-1', father_occupation: 'Manager', mother_name: 'Ayesha Ali', mother_phone: '03331234525', mother_cnic: '42202-8882222-2', mother_occupation: 'HR', guardian_name: 'Kamran Ali', guardian_phone: '03211234525', guardian_cnic: '42201-8882222-1', guardian_address: 'Flat 88, FB Area', blood_group: 'B+' },

    { ...template, roll_no: '211', first_name: 'Aiman', last_name: 'Haider', gender: 'Female', dob: '2015-05-20', student_mobile: '03001234611', email: 'aiman.haider@example.com', current_address: 'House 22, Johar', permanent_address: 'House 22, Johar', father_name: 'Haider Ali', father_phone: '03211234526', father_cnic: '42201-9993333-1', father_occupation: 'Pilot', mother_name: 'Mehreen Ali', mother_phone: '03331234526', mother_cnic: '42202-9993333-2', mother_occupation: 'Air Hostess', guardian_name: 'Haider Ali', guardian_phone: '03211234526', guardian_cnic: '42201-9993333-1', guardian_address: 'House 22, Johar', blood_group: 'AB+' },

    { ...template, roll_no: '212', first_name: 'Rayyan', last_name: 'Sheikh', gender: 'Male', dob: '2015-01-15', student_mobile: '03001234612', email: 'rayyan.sheikh@example.com', current_address: 'Villa 12, Bahria', permanent_address: 'Villa 12, Bahria', father_name: 'Adnan Sheikh', father_phone: '03211234527', father_cnic: '42201-1114444-1', father_occupation: 'Entrepreneur', mother_name: 'Sofia Sheikh', mother_phone: '03331234527', mother_cnic: '42202-1114444-2', mother_occupation: 'Chef', guardian_name: 'Adnan Sheikh', guardian_phone: '03211234527', guardian_cnic: '42201-1114444-1', guardian_address: 'Villa 12, Bahria', blood_group: 'O+' },

    { ...template, roll_no: '213', first_name: 'Dua', last_name: 'Rashid', gender: 'Female', dob: '2015-08-28', student_mobile: '03001234613', email: 'dua.rashid@example.com', current_address: 'Apartment 5, DHA', permanent_address: 'Apartment 5, DHA', father_name: 'Rashid Mahmood', father_phone: '03211234528', father_cnic: '42201-2225555-1', father_occupation: 'Lawyer', mother_name: 'Farah Rashid', mother_phone: '03331234528', mother_cnic: '42202-2225555-2', mother_occupation: 'Judge', guardian_name: 'Rashid Mahmood', guardian_phone: '03211234528', guardian_cnic: '42201-2225555-1', guardian_address: 'Apartment 5, DHA', blood_group: 'A-' },

    { ...template, roll_no: '214', first_name: 'Armaan', last_name: 'Siddiqui', gender: 'Male', dob: '2015-06-10', student_mobile: '03001234614', email: 'armaan.siddiqui@example.com', current_address: 'House 99, PECHS', permanent_address: 'House 99, PECHS', father_name: 'Farhan Siddiqui', father_phone: '03211234529', father_cnic: '42201-3336666-1', father_occupation: 'Surgeon', mother_name: 'Laiba Siddiqui', mother_phone: '03331234529', mother_cnic: '42202-3336666-2', mother_occupation: 'Nurse', guardian_name: 'Farhan Siddiqui', guardian_phone: '03211234529', guardian_cnic: '42201-3336666-1', guardian_address: 'House 99, PECHS', blood_group: 'B-' },

    { ...template, roll_no: '215', first_name: 'Hiba', last_name: 'Qureshi', gender: 'Female', dob: '2015-04-03', student_mobile: '03001234615', email: 'hiba.qureshi@example.com', current_address: 'Flat 77, Clifton', permanent_address: 'Flat 77, Clifton', father_name: 'Junaid Qureshi', father_phone: '03211234530', father_cnic: '42201-4447777-1', father_occupation: 'Accountant', mother_name: 'Asma Qureshi', mother_phone: '03331234530', mother_cnic: '42202-4447777-2', mother_occupation: 'Auditor', guardian_name: 'Junaid Qureshi', guardian_phone: '03211234530', guardian_cnic: '42201-4447777-1', guardian_address: 'Flat 77, Clifton', blood_group: 'O-' },

    { ...template, roll_no: '216', first_name: 'Abdullah', last_name: 'Aziz', gender: 'Male', dob: '2015-09-14', student_mobile: '03001234616', email: 'abdullah.aziz@example.com', current_address: 'House 33, Gulshan', permanent_address: 'House 33, Gulshan', father_name: 'Abdul Aziz', father_phone: '03211234531', father_cnic: '42201-5558888-1', father_occupation: 'Imam', mother_name: 'Khadija Aziz', mother_phone: '03331234531', mother_cnic: '42202-5558888-2', mother_occupation: 'Teacher', guardian_name: 'Abdul Aziz', guardian_phone: '03211234531', guardian_cnic: '42201-5558888-1', guardian_address: 'House 33, Gulshan', blood_group: 'AB-' },

    { ...template, roll_no: '217', first_name: 'Iqra', last_name: 'Saleem', gender: 'Female', dob: '2015-11-07', student_mobile: '03001234617', email: 'iqra.saleem@example.com', current_address: 'Apartment 66, Saddar', permanent_address: 'Apartment 66, Saddar', father_name: 'Saleem Akhtar', father_phone: '03211234532', father_cnic: '42201-6669999-1', father_occupation: 'Chemist', mother_name: 'Shaista Saleem', mother_phone: '03331234532', mother_cnic: '42202-6669999-2', mother_occupation: 'Pharmacist', guardian_name: 'Saleem Akhtar', guardian_phone: '03211234532', guardian_cnic: '42201-6669999-1', guardian_address: 'Apartment 66, Saddar', blood_group: 'A+' },

    { ...template, roll_no: '218', first_name: 'Saad', last_name: 'Ibrahim', gender: 'Male', dob: '2015-02-28', student_mobile: '03001234618', email: 'saad.ibrahim@example.com', current_address: 'House 11, Korangi', permanent_address: 'House 11, Korangi', father_name: 'Ibrahim Hussain', father_phone: '03211234533', father_cnic: '42201-7770000-1', father_occupation: 'Electrician', mother_name: 'Uzma Ibrahim', mother_phone: '03331234533', mother_cnic: '42202-7770000-2', mother_occupation: 'Tailor', guardian_name: 'Ibrahim Hussain', guardian_phone: '03211234533', guardian_cnic: '42201-7770000-1', guardian_address: 'House 11, Korangi', blood_group: 'B+' },

    { ...template, roll_no: '219', first_name: 'Aliza', last_name: 'Usman', gender: 'Female', dob: '2015-12-19', student_mobile: '03001234619', email: 'aliza.usman@example.com', current_address: 'Villa 44, Scheme 33', permanent_address: 'Villa 44, Scheme 33', father_name: 'Usman Tariq', father_phone: '03211234534', father_cnic: '42201-8881111-1', father_occupation: 'Developer', mother_name: 'Maheen Usman', mother_phone: '03331234534', mother_cnic: '42202-8881111-2', mother_occupation: 'Designer', guardian_name: 'Usman Tariq', guardian_phone: '03211234534', guardian_cnic: '42201-8881111-1', guardian_address: 'Villa 44, Scheme 33', blood_group: 'O+' },

    { ...template, roll_no: '220', first_name: 'Talha', last_name: 'Hameed', gender: 'Male', dob: '2015-07-22', student_mobile: '03001234620', email: 'talha.hameed@example.com', current_address: 'Flat 21, Malir', permanent_address: 'Flat 21, Malir', father_name: 'Hameed Raza', father_phone: '03211234535', father_cnic: '42201-9992222-1', father_occupation: 'Driver', mother_name: 'Shazia Hameed', mother_phone: '03331234535', mother_cnic: '42202-9992222-2', mother_occupation: 'Cook', guardian_name: 'Hameed Raza', guardian_phone: '03211234535', guardian_cnic: '42201-9992222-1', guardian_address: 'Flat 21, Malir', blood_group: 'AB+' }
];

// Create workbook and worksheet
const ws = XLSX.utils.json_to_sheet(students);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Students");

// Write to file
XLSX.writeFile(wb, "Class2_Red_20_Students.xlsx");

console.log("✅ Excel file generated: Class2_Red_20_Students.xlsx");
console.log(`📊 Total Students: ${students.length}`);
console.log("\n👨‍👩‍👧‍👦 Family Relationships:");
console.log("\n🔗 SIBLINGS (Same father_cnic - Auto-linking):");
console.log("  - Hassan Khan → Sibling of Ahmed & Ali (Class 1)");
console.log("  - Maria Ahmed → Sibling of Sara & Ayesha (Class 1)");
console.log("  - Umer Malik → Sibling of Usman, Bilal & Zainab (Class 1)");
console.log("\n👥 COUSINS (Different father_cnic - Manual linking test):");
console.log("  - Fahad & Sana Khan → Cousins of Ahmed, Ali, Hassan");
console.log("  - Zain Ahmed → Cousin of Sara, Ayesha, Maria");
console.log("  - Aliya & Arham Malik → Cousins of Usman, Bilal, Zainab, Umer");
console.log("\n🆕 NEW FAMILIES: 12 students with no relation to Class 1");
console.log("\n🎯 Expected Import Results:");
console.log("  - 3 students auto-linked by CNIC (siblings)");
console.log("  - 5 students in cousin families (for manual linking)");
console.log("  - 12 new families created");
