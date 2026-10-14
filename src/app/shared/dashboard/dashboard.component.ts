import { Component } from '@angular/core';
import { PatientService } from '../../Services/Patient.service';
import { Patient } from '../../models/patient.model';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent {

  patient: Patient = {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    gender: 'male', // Default gender
    address: {
      city: '',
      state: '',
      zip: ''
    }
  };
  errorMessage: string | null = null;
  saving = false;
  patients: Patient[] = [];

  constructor(private patientService: PatientService) { }

  ngOnInit() {
    this.loadPatients();
  }

  addPatient() {
    this.errorMessage = null;
    this.saving = true;
    this.patientService.addPatient(this.patient)
      .subscribe({
        next: () => {
          this.saving = false;
          this.resetForm();
          this.loadPatients(); // Reload patient list after adding
        },
        error: (error) => {
          this.saving = false;
          this.errorMessage = 'Error adding patient.';
          console.error('Add patient error:', error);
        }
      });
  }

  loadPatients() {
    this.errorMessage = null;
    this.patientService.getPatientList()
      .subscribe({
        next: (patients) => {
          this.patients = patients;
        },
        error: (error) => {
          this.errorMessage = 'Could not load patients.';
          console.error('Fetch patients error:', error);
        }
      });
  }

  deletePatient(p: Patient) {
    if (!window.confirm(`Delete ${p.firstName} ${p.lastName}?`)) {
      return;
    }
    this.errorMessage = null;
    this.patientService.deletePatient(p.id!)
      .subscribe({
        next: () => {
          this.loadPatients(); // Reload patient list after deleting
        },
        error: (error) => {
          this.errorMessage = 'Error deleting patient.';
          console.error('Delete patient error:', error);
        }
      });
  }

  private resetForm() {
    this.patient = {
        firstName: '',
      lastName: '',
      email: '',
      phone: '',
      gender: 'male',
      address: {
        city: '',
        state: '',
        zip: ''
      }
    };
  }

  isFormValid(): boolean {
    // Implement your form validation logic here
    // For simplicity, just check if all required fields are filled
    return (
      this.patient.firstName.trim() !== '' &&
      this.patient.lastName.trim() !== '' &&
      this.patient.email.trim() !== '' &&
      this.patient.phone.trim() !== '' &&
      this.patient.address.city.trim() !== '' &&
      this.patient.address.state.trim() !== '' &&
      this.patient.address.zip.trim() !== ''
    );
  }
}
