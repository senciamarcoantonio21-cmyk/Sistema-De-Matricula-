"use strict";

const ADMIN_USERNAME = "admin.demo";
const ADMIN_PASSWORD = "Adm1n-Demo!2025";
const STUDENTS_STORAGE_KEY = "iestp-demo-students";
const SESSION_STORAGE_KEY = "iestp-demo-session";
const REMEMBERED_SESSION_KEY = "iestp-demo-remembered-session";
const DOCUMENTS_DATABASE_NAME = "iestp-demo-documents";
const MAX_DOCUMENT_SIZE = 5 * 1024 * 1024;

const careers = [
  { code: "APSTI", name: "Arquitectura de Plataformas y Servicios de TI", vacancies: 18, capacity: 100, icon: "⌘" },
  { code: "EI", name: "Electrónica Industrial", vacancies: 12, capacity: 38, icon: "ϟ" },
  { code: "MP", name: "Mecánica de Producción", vacancies: 15, capacity: 58, icon: "✣" },
  { code: "OM", name: "Operaciones Mineras", vacancies: 9, capacity: 100, icon: "◆" },
  { code: "PA", name: "Producción Agropecuaria", vacancies: 21, capacity: 49, icon: "⌁" }
];

const loginPage = document.getElementById("login-page");
const adminDashboard = document.getElementById("admin-dashboard");
const studentDashboard = document.getElementById("student-dashboard");
const loginForm = document.getElementById("login-form");
const passwordInput = document.getElementById("password");
const passwordToggle = document.getElementById("password-toggle");
const formMessage = document.getElementById("form-message");
const adminSearch = document.getElementById("admin-search");
const adminFilter = document.getElementById("admin-filter");
const adminEmpty = document.getElementById("admin-empty");
const directorySearch = document.getElementById("directory-search");
const directoryEmpty = document.getElementById("directory-empty");
const adminFeedback = document.getElementById("admin-feedback");
const adminDialog = document.getElementById("admin-dialog");
const newEnrollmentDialog = document.getElementById("new-enrollment-dialog");
const newEnrollmentForm = document.getElementById("new-enrollment-form");
const enrollmentFormMessage = document.getElementById("enrollment-form-message");
const createdAccountDialog = document.getElementById("created-account-dialog");
const studentConfirmDialog = document.getElementById("student-confirm-dialog");
const adminSidebar = document.querySelector(".admin-sidebar");
const studentSidebar = document.querySelector(".student-sidebar");
const adminMenuToggle = document.getElementById("admin-menu-toggle");
const studentMenuToggle = document.getElementById("student-menu-toggle");
const adminRoutes = {
  "#panel-administrador": "panel-general",
  "#panel-general": "panel-general",
  "#matriculas-recientes": "matriculas-recientes",
  "#estudiantes": "estudiantes",
  "#ocupacion-carreras": "ocupacion-carreras",
  "#reportes": "reportes",
  "#configuracion": "configuracion"
};
const studentRoutes = {
  "#estudiante-inicio": "estudiante-inicio",
  "#estudiante-carreras": "estudiante-carreras",
  "#estudiante-matricula": "estudiante-matricula",
  "#estudiante-perfil": "estudiante-perfil"
};

let students = JSON.parse(localStorage.getItem(STUDENTS_STORAGE_KEY) || "[]");
let feedbackTimeout;
let careerFilter = "todas";
let reviewDocumentUrls = [];
let currentReviewUsername = "";

students.forEach((student) => {
  if (!student.documents) student.documents = { identity: null, academic: null };
  if (!student.documents.identity || !student.documents.academic) {
    student.documentsComplete = false;
  }
  if (typeof student.observation !== "string") student.observation = "";
});

function getSession() {
  const savedSession =
    sessionStorage.getItem(SESSION_STORAGE_KEY) || localStorage.getItem(REMEMBERED_SESSION_KEY);
  return savedSession ? JSON.parse(savedSession) : null;
}

function saveStudents() {
  localStorage.setItem(STUDENTS_STORAGE_KEY, JSON.stringify(students));
}

function normalizeText(value) {
  return value
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function setSession(role, username) {
  const serializedSession = JSON.stringify({ role, username });
  sessionStorage.removeItem(SESSION_STORAGE_KEY);
  localStorage.removeItem(REMEMBERED_SESSION_KEY);
  if (document.querySelector('#login-form [name="remember"]').checked) {
    localStorage.setItem(REMEMBERED_SESSION_KEY, serializedSession);
  } else {
    sessionStorage.setItem(SESSION_STORAGE_KEY, serializedSession);
  }
}

function showLoginMessage(message) {
  formMessage.textContent = message;
  formMessage.classList.add("is-visible");
}

async function hashPassword(password, salt) {
  const bytes = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await window.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function openDocumentsDatabase() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error("El navegador no permite guardar documentos localmente."));
      return;
    }
    const request = window.indexedDB.open(DOCUMENTS_DATABASE_NAME, 2);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("documents")) {
        request.result.createObjectStore("documents");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("No se pudo abrir el almacenamiento de documentos."));
  });
}

async function saveStudentDocument(username, key, file) {
  const database = await openDocumentsDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction("documents", "readwrite");
    transaction.objectStore("documents").put(file, `${username}:${key}`);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error || new Error("No se pudo guardar el documento."));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error || new Error("No se pudo guardar el documento."));
    };
  });
}

async function readStudentDocument(username, key) {
  const database = await openDocumentsDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction("documents", "readonly");
    const request = transaction.objectStore("documents").get(`${username}:${key}`);
    let file = null;
    request.onsuccess = () => {
      file = request.result || null;
    };
    transaction.oncomplete = () => {
      database.close();
      resolve(file);
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error || new Error("No se pudo leer el documento."));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error || new Error("No se pudo leer el documento."));
    };
  });
}

passwordToggle.addEventListener("click", () => {
  const isPasswordHidden = passwordInput.type === "password";
  passwordInput.type = isPasswordHidden ? "text" : "password";
  passwordToggle.setAttribute("aria-pressed", String(isPasswordHidden));
  passwordToggle.setAttribute(
    "aria-label",
    isPasswordHidden ? "Ocultar contraseña" : "Mostrar contraseña"
  );
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  formMessage.classList.remove("is-visible");

  const username = document.getElementById("username").value.trim();
  const password = passwordInput.value;

  if (username.toLocaleLowerCase("es") === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    setSession("admin", ADMIN_USERNAME);
    window.location.hash = "#panel-general";
    updatePageView();
    return;
  }

  const student = students.find(
    (account) => account.username.toLocaleLowerCase("es") === username.toLocaleLowerCase("es")
  );
  if (!student) {
    showLoginMessage("Usuario o contraseña incorrectos. Verifica tus credenciales asignadas.");
    return;
  }

  if (!window.crypto || !window.crypto.subtle) {
    showLoginMessage("Este navegador no permite verificar las credenciales. Abre el proyecto con Live Server.");
    return;
  }

  try {
    const passwordHash = await hashPassword(password, student.passwordSalt);
    if (passwordHash !== student.passwordHash) {
      showLoginMessage("Usuario o contraseña incorrectos. Verifica tus credenciales asignadas.");
      return;
    }
  } catch (error) {
    showLoginMessage("No se pudieron verificar las credenciales. Intenta abrir el proyecto con Live Server.");
    return;
  }

  setSession("student", student.username);
  window.location.hash = "#estudiante-inicio";
  updatePageView();
});

loginForm.addEventListener("input", () => {
  formMessage.classList.remove("is-visible");
});

function setAdminMenuOpen(isOpen) {
  adminSidebar.classList.toggle("is-menu-open", isOpen);
  adminDashboard.classList.toggle("menu-open", isOpen);
  adminMenuToggle.setAttribute("aria-expanded", String(isOpen));
  adminMenuToggle.setAttribute(
    "aria-label",
    isOpen ? "Cerrar menú de administración" : "Abrir menú de administración"
  );
}

function setStudentMenuOpen(isOpen) {
  studentSidebar.classList.toggle("is-menu-open", isOpen);
  studentDashboard.classList.toggle("menu-open", isOpen);
  studentMenuToggle.setAttribute("aria-expanded", String(isOpen));
  studentMenuToggle.setAttribute(
    "aria-label",
    isOpen ? "Cerrar menú del estudiante" : "Abrir menú del estudiante"
  );
}

adminMenuToggle.addEventListener("click", () => {
  setAdminMenuOpen(!adminSidebar.classList.contains("is-menu-open"));
});

studentMenuToggle.addEventListener("click", () => {
  setStudentMenuOpen(!studentSidebar.classList.contains("is-menu-open"));
});

document.getElementById("admin-menu-backdrop").addEventListener("click", () => setAdminMenuOpen(false));
document.getElementById("student-menu-backdrop").addEventListener("click", () => setStudentMenuOpen(false));

document.addEventListener("click", (event) => {
  if (window.matchMedia("(max-width: 760px)").matches) {
    if (!adminSidebar.contains(event.target) && !adminMenuToggle.contains(event.target)) {
      setAdminMenuOpen(false);
    }
    if (!studentSidebar.contains(event.target) && !studentMenuToggle.contains(event.target)) {
      setStudentMenuOpen(false);
    }
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    setAdminMenuOpen(false);
    setStudentMenuOpen(false);
  }
});

function setRoute(hash) {
  if (window.location.hash === hash) {
    updatePageView();
  } else {
    window.location.hash = hash;
  }
}

function updatePageView() {
  const session = getSession();
  const hash = window.location.hash;

  if (!session) {
    loginPage.hidden = false;
    adminDashboard.hidden = true;
    studentDashboard.hidden = true;
    document.title = "Iniciar sesión | IESTP Espinar";
    if (hash) window.location.hash = "";
    return;
  }

  if (session.role === "admin") {
    if (!Object.prototype.hasOwnProperty.call(adminRoutes, hash)) {
      window.location.hash = "#panel-general";
      return;
    }
    loginPage.hidden = true;
    adminDashboard.hidden = false;
    studentDashboard.hidden = true;
    document.querySelectorAll(".admin-view").forEach((view) => {
      view.hidden = view.id !== adminRoutes[hash];
    });

    const activeLink = document.querySelector(`.admin-nav-link[href="#${adminRoutes[hash]}"]`);
    document.querySelectorAll(".admin-nav-link").forEach((link) => {
      const isActive = link === activeLink;
      link.classList.toggle("is-active", isActive);
      if (isActive) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    document.querySelector(".admin-topbar-heading strong").textContent =
      activeLink ? activeLink.dataset.title : "Panel general";
    document.title = "Panel administrativo | IESTP Espinar";
    renderAdminTables();
    return;
  }

  if (session.role === "student") {
    const student = students.find(
      (account) => account.username.toLocaleLowerCase("es") === session.username.toLocaleLowerCase("es")
    );
    if (!student) {
      endSession();
      return;
    }
    if (!Object.prototype.hasOwnProperty.call(studentRoutes, hash)) {
      window.location.hash = "#estudiante-inicio";
      return;
    }
    loginPage.hidden = true;
    adminDashboard.hidden = true;
    studentDashboard.hidden = false;
    document.querySelectorAll(".student-view").forEach((view) => {
      view.hidden = view.id !== studentRoutes[hash];
    });

    document.querySelectorAll(".student-nav-link").forEach((link) => {
      const isActive = link.getAttribute("href") === hash;
      link.classList.toggle("is-active", isActive);
      if (isActive) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    document.title = "Portal del estudiante | IESTP Espinar";
    renderStudentPortal(student);
    return;
  }

  endSession();
}

function endSession() {
  sessionStorage.removeItem(SESSION_STORAGE_KEY);
  localStorage.removeItem(REMEMBERED_SESSION_KEY);
  loginForm.reset();
  passwordInput.type = "password";
  passwordToggle.setAttribute("aria-pressed", "false");
  passwordToggle.setAttribute("aria-label", "Mostrar contraseña");
  formMessage.classList.remove("is-visible");
  window.location.hash = "";
  loginPage.hidden = false;
  adminDashboard.hidden = true;
  studentDashboard.hidden = true;
  document.title = "Iniciar sesión | IESTP Espinar";
}

function showAdminFeedback(message) {
  adminFeedback.textContent = message;
  adminFeedback.classList.add("is-visible");
  window.clearTimeout(feedbackTimeout);
  feedbackTimeout = window.setTimeout(() => {
    adminFeedback.classList.remove("is-visible");
  }, 3000);
}

function filterAdminRows() {
  const searchTerm = normalizeText(adminSearch.value);
  const selectedStatus = adminFilter.value;
  let visibleRows = 0;

  document.querySelectorAll("#admin-enrollment-rows tr").forEach((row) => {
    const matchesSearch = normalizeText(row.dataset.search || row.textContent).includes(searchTerm);
    const matchesStatus = selectedStatus === "todos" || row.dataset.status === selectedStatus;
    row.hidden = !(matchesSearch && matchesStatus);
    if (!row.hidden) visibleRows += 1;
  });
  adminEmpty.hidden = visibleRows > 0;
}

function filterDirectoryRows() {
  const searchTerm = normalizeText(directorySearch.value);
  let visibleRows = 0;

  document.querySelectorAll("#student-directory-rows tr").forEach((row) => {
    row.hidden = !normalizeText(row.dataset.search || row.textContent).includes(searchTerm);
    if (!row.hidden) visibleRows += 1;
  });
  directoryEmpty.hidden = visibleRows > 0;
}

adminSearch.addEventListener("input", filterAdminRows);
adminFilter.addEventListener("change", filterAdminRows);
directorySearch.addEventListener("input", filterDirectoryRows);

function createStudentCell(student) {
  const wrapper = document.createElement("span");
  wrapper.className = "admin-student";
  const initials = document.createElement("i");
  initials.textContent = `${student.firstName[0]}${student.lastName[0]}`.toLocaleUpperCase("es");
  const details = document.createElement("span");
  const name = document.createElement("strong");
  name.textContent = `${student.firstName} ${student.lastName}`;
  const subtext = document.createElement("small");
  subtext.textContent = `${student.code} · DNI ${student.dni}`;
  details.append(name, subtext);
  wrapper.append(initials, details);
  return wrapper;
}

function makeCell(text) {
  const cell = document.createElement("td");
  cell.textContent = text;
  return cell;
}

function getRemainingVacancies(career, currentStudent) {
  const reserved = students.filter(
    (student) => student.career === career.name &&
      (!currentStudent || student.username !== currentStudent.username)
  ).length;
  return Math.max(0, career.vacancies - reserved);
}

function renderAdminSummary() {
  const approvedCount = students.filter((student) => student.approved).length;
  const reviewCount = students.filter((student) => student.confirmed && !student.approved).length;
  const vacancies = careers.reduce(
    (total, career) => total + getRemainingVacancies(career),
    0
  );
  const applicants = 1244 + students.length;
  const approved = 842 + approvedCount;
  const inReview = 55 + reviewCount;
  const summary = {
    "stat-applicants": applicants,
    "stat-approved": approved,
    "stat-review": inReview,
    "stat-vacancies": vacancies,
    "report-applicants": applicants,
    "report-approved": approved,
    "report-review": inReview,
    "report-vacancies-value": vacancies
  };
  Object.entries(summary).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element) element.textContent = String(value);
  });

  document.querySelectorAll(".admin-career[data-career-code]").forEach((item) => {
    const career = careers.find((option) => option.code === item.dataset.careerCode);
    if (!career) return;
    const remaining = getRemainingVacancies(career);
    const occupancy = Math.min(100, Math.round(((career.capacity - remaining) / career.capacity) * 100));
    item.querySelector("strong").textContent = `${occupancy}%`;
    item.querySelector("i b").style.width = `${occupancy}%`;
    item.querySelector("small").textContent = `${remaining} vacantes disponibles`;
  });

  const applicantTotal = Math.max(1, applicants);
  const approvedPercent = Math.round((approved / applicantTotal) * 100);
  const reviewPercent = Math.round((inReview / applicantTotal) * 100);
  const vacancyCapacity = careers.reduce((total, career) => total + career.capacity, 0);
  const vacancyPercent = Math.round((vacancies / vacancyCapacity) * 100);
  document.getElementById("report-approved-percent").textContent = `${approvedPercent}%`;
  document.getElementById("report-approved-bar").style.width = `${approvedPercent}%`;
  document.getElementById("report-review-percent").textContent = `${reviewPercent}%`;
  document.getElementById("report-review-bar").style.width = `${reviewPercent}%`;
  document.getElementById("report-vacancies-bar").style.width = `${vacancyPercent}%`;
}

function renderAdminTables() {
  const enrollmentRows = document.getElementById("admin-enrollment-rows");
  const directoryRows = document.getElementById("student-directory-rows");
  enrollmentRows.querySelectorAll("[data-username]").forEach((row) => row.remove());
  directoryRows.querySelectorAll("[data-username]").forEach((row) => row.remove());

  students.forEach((student) => {
    const searchText = normalizeText(
      `${student.firstName} ${student.lastName} ${student.code} ${student.dni} ${student.career || ""}`
    );
    const status = student.approved
      ? "aprobada"
      : student.confirmed
        ? "revision"
        : student.observation
          ? "observada"
          : "pendiente";
    const statusLabel = student.approved
      ? "Aprobada"
      : student.confirmed
        ? "En revisión"
        : student.observation
          ? "Observada"
          : "Pendiente del postulante";
    const enrollmentRow = document.createElement("tr");
    enrollmentRow.dataset.username = student.username;
    enrollmentRow.dataset.status = status;
    enrollmentRow.dataset.search = searchText;
    const studentCell = document.createElement("td");
    studentCell.append(createStudentCell(student));
    const statusCell = document.createElement("td");
    const statusBadge = document.createElement("span");
    statusBadge.className = `admin-status ${
      student.approved
        ? "status-approved"
        : student.confirmed
          ? "status-review"
          : student.observation
            ? "status-observed"
            : "status-pending"
    }`;
    statusBadge.textContent = statusLabel;
    statusCell.append(statusBadge);
    const actionCell = document.createElement("td");
    const actions = document.createElement("span");
    actions.className = "admin-actions";
    const approveButton = document.createElement("button");
    approveButton.type = "button";
    approveButton.className = "admin-row-button approve-button";
    approveButton.textContent = "✓";
    approveButton.title = student.confirmed ? "Revisar solicitud" : "Disponible después del envío";
    approveButton.setAttribute("aria-label", `Revisar solicitud de ${student.firstName} ${student.lastName}`);
    approveButton.disabled = !student.confirmed || student.approved === true;
    if (student.approved) approveButton.classList.add("is-approved");
    const detailsButton = document.createElement("button");
    detailsButton.type = "button";
    detailsButton.className = "admin-row-button detail-button";
    detailsButton.textContent = "◉";
    detailsButton.setAttribute("aria-label", `Ver matrícula de ${student.firstName} ${student.lastName}`);
    actions.append(approveButton, detailsButton);
    actionCell.append(actions);
    enrollmentRow.append(
      studentCell,
      makeCell(student.career || "Por elegir"),
      makeCell(student.createdAt),
      statusCell,
      actionCell
    );
    enrollmentRows.append(enrollmentRow);

    const directoryRow = document.createElement("tr");
    directoryRow.dataset.username = student.username;
    directoryRow.dataset.search = searchText;
    const directoryStudentCell = document.createElement("td");
    directoryStudentCell.append(createStudentCell(student));
    const directoryStatus = document.createElement("span");
    directoryStatus.className = `admin-status ${
      student.approved
        ? "status-approved"
        : student.confirmed
          ? "status-review"
          : student.observation
            ? "status-observed"
            : "status-pending"
    }`;
    directoryStatus.textContent = student.approved
      ? "Aprobada"
      : student.confirmed
        ? "En revisión"
        : student.observation
          ? "Observada"
          : "Pendiente";
    const directoryStatusCell = document.createElement("td");
    directoryStatusCell.append(directoryStatus);
    directoryRow.append(
      directoryStudentCell,
      makeCell(student.code),
      makeCell(student.dni),
      makeCell(student.career || "Por elegir"),
      directoryStatusCell
    );
    directoryRows.append(directoryRow);
  });

  const pendingCount = document.querySelectorAll(
    '#admin-enrollment-rows tr[data-status="pendiente"]'
  ).length;
  const enrollmentCount = document.getElementById("enrollment-count");
  enrollmentCount.textContent = String(pendingCount);
  enrollmentCount.hidden = pendingCount === 0;
  renderAdminSummary();
  filterAdminRows();
  filterDirectoryRows();
}

function addReviewField(container, label, value) {
  const field = document.createElement("div");
  field.className = "admin-review-field";
  const fieldLabel = document.createElement("small");
  fieldLabel.textContent = label;
  const fieldValue = document.createElement("strong");
  fieldValue.textContent = value || "No registrado";
  field.append(fieldLabel, fieldValue);
  container.append(field);
}

function clearReviewDocumentUrls() {
  reviewDocumentUrls.forEach((url) => URL.revokeObjectURL(url));
  reviewDocumentUrls = [];
}

async function loadReviewDocumentLinks(student) {
  const section = document.getElementById("admin-review-documents");
  const linkList = document.getElementById("admin-review-document-links");
  const message = document.getElementById("admin-review-document-message");
  const documents = student.documents || {};
  const entries = [
    ["identity", "Documento de identidad"],
    ["academic", "Documento académico"]
  ].filter(([key]) => documents[key]);

  section.hidden = false;
  linkList.replaceChildren();
  message.textContent = entries.length ? "" : "El postulante todavía no adjuntó documentos.";
  for (const [key, label] of entries) {
    const file = await readStudentDocument(student.username, key);
    if (!file) {
      message.textContent = "No se encontró un archivo adjunto en este navegador.";
      continue;
    }
    const url = URL.createObjectURL(file);
    reviewDocumentUrls.push(url);
    const link = document.createElement("a");
    link.className = "admin-review-document-link";
    link.href = url;
    link.download = documents[key].name;
    link.textContent = `${label}: ${documents[key].name} · Descargar`;
    linkList.append(link);
  }
}

async function openReviewDialog(student) {
  clearReviewDocumentUrls();
  currentReviewUsername = student.username;
  document.getElementById("admin-dialog-eyebrow").textContent = "REVISIÓN DE MATRÍCULA";
  document.getElementById("admin-dialog-name").textContent =
    `${student.firstName} ${student.lastName}`;
  document.getElementById("admin-dialog-info").textContent =
    `${student.code} · Estado: ${
      student.approved ? "Aprobada" : student.confirmed ? "En revisión" : student.observation ? "Observada" : "Pendiente del postulante"
    }`;
  const record = document.getElementById("admin-review-record");
  record.replaceChildren();
  record.hidden = false;
  addReviewField(record, "DNI", student.dni);
  addReviewField(record, "Correo", student.email);
  addReviewField(record, "Teléfono", student.phone);
  addReviewField(record, "Distrito", student.district);
  addReviewField(record, "Carrera", student.career || "Aún no seleccionada");
  addReviewField(record, "Fecha de registro", student.createdAt);
  if (student.observation) addReviewField(record, "Observación anterior", student.observation);

  const canReview = student.confirmed && !student.approved;
  document.getElementById("admin-observation-field").hidden = !canReview;
  document.getElementById("admin-review-actions").hidden = !canReview;
  document.getElementById("admin-observation").value = "";
  document.getElementById("admin-review-document-message").textContent = "Cargando documentos...";
  adminDialog.showModal();
  try {
    await loadReviewDocumentLinks(student);
  } catch (error) {
    document.getElementById("admin-review-document-message").textContent =
      `No se pudieron abrir los documentos: ${error.message}`;
  }
}

adminDialog.addEventListener("close", clearReviewDocumentUrls);
document.getElementById("admin-observation").addEventListener("input", (event) => {
  event.currentTarget.setCustomValidity("");
});

document.getElementById("admin-approve-application").addEventListener("click", () => {
  const student = students.find((account) => account.username === currentReviewUsername);
  if (!student || !student.confirmed || student.approved) return;
  const name = `${student.firstName} ${student.lastName}`;
  student.approved = true;
  student.observation = "";
  student.status = "Aprobada";
  student.approvedAt = new Date().toISOString();
  saveStudents();
  adminDialog.close();
  renderAdminTables();
  showAdminFeedback(`Matrícula de ${name} aprobada.`);
});

document.getElementById("admin-request-correction").addEventListener("click", () => {
  const student = students.find((account) => account.username === currentReviewUsername);
  const observationInput = document.getElementById("admin-observation");
  const reason = observationInput.value.trim();
  if (!student || !student.confirmed || student.approved) return;
  if (!reason) {
    observationInput.setCustomValidity("Escribe qué debe corregir el postulante.");
    observationInput.reportValidity();
    return;
  }
  student.confirmed = false;
  student.approved = false;
  student.observation = reason;
  student.status = "Observada";
  const name = `${student.firstName} ${student.lastName}`;
  saveStudents();
  adminDialog.close();
  renderAdminTables();
  showAdminFeedback(`Se solicitaron correcciones a ${name}.`);
});

document.getElementById("admin-settings-form").addEventListener("submit", (event) => {
  event.preventDefault();
  document.getElementById("settings-message").textContent =
    "Cambios de demostración: aún no se guardan en el sistema.";
});

document.getElementById("admin-enrollment-rows").addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  const row = button.closest("tr");
  const student = students.find((account) => account.username === row.dataset.username);

  if (button.classList.contains("approve-button")) {
    if (student) {
      if (student.confirmed && !student.approved) openReviewDialog(student);
      return;
    }
    const studentName = row.querySelector(".admin-student strong").textContent;
    const status = row.querySelector(".admin-status");
    row.dataset.status = "aprobada";
    status.className = "admin-status status-approved";
    status.textContent = "Aprobada";
    button.classList.add("is-approved");
    button.disabled = true;
    button.setAttribute("aria-label", `Matrícula de ${studentName} aprobada`);
    showAdminFeedback(`Matrícula de ${studentName} aprobada en esta demostración.`);
    filterAdminRows();
    return;
  }

  if (button.classList.contains("detail-button")) {
    if (student) {
      openReviewDialog(student);
      return;
    }
    const studentName = row.querySelector(".admin-student strong").textContent;
    const studentInfo = row.querySelector(".admin-student small").textContent;
    const career = row.cells[1].textContent;
    const status = row.querySelector(".admin-status").textContent;
    currentReviewUsername = "";
    document.getElementById("admin-dialog-eyebrow").textContent = "DETALLE DE SOLICITUD";
    document.getElementById("admin-dialog-name").textContent = studentName;
    document.getElementById("admin-dialog-info").textContent =
      `${studentInfo}. Carrera: ${career}. Estado: ${status}.`;
    document.getElementById("admin-review-record").hidden = true;
    document.getElementById("admin-review-documents").hidden = true;
    document.getElementById("admin-observation-field").hidden = true;
    document.getElementById("admin-review-actions").hidden = true;
    adminDialog.showModal();
  }
});

function openNewEnrollmentDialog() {
  enrollmentFormMessage.textContent = "";
  newEnrollmentForm.reset();
  newEnrollmentDialog.showModal();
}

document.getElementById("new-enrollment").addEventListener("click", openNewEnrollmentDialog);
document.getElementById("new-enrollment-from-list").addEventListener("click", openNewEnrollmentDialog);

newEnrollmentForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  enrollmentFormMessage.textContent = "";

  const values = new FormData(newEnrollmentForm);
  const firstName = String(values.get("firstName")).trim();
  const lastName = String(values.get("lastName")).trim();
  const dni = String(values.get("dni")).trim();
  const email = String(values.get("email")).trim();
  const username = String(values.get("username")).trim();
  const password = String(values.get("password"));
  const normalizedUsername = username.toLocaleLowerCase("es");

  const usernameExists = students.some(
    (student) => student.username.toLocaleLowerCase("es") === normalizedUsername
  );
  const dniExists = students.some((student) => student.dni === dni) ||
    Array.from(document.querySelectorAll("#admin-enrollment-rows tr")).some((row) => row.textContent.includes(dni));
  if (usernameExists || normalizedUsername === ADMIN_USERNAME) {
    enrollmentFormMessage.textContent = "Ese usuario ya está asignado. Elige otro usuario.";
    return;
  }
  if (dniExists) {
    enrollmentFormMessage.textContent = "Ya existe una matrícula con ese DNI.";
    return;
  }
  if (!window.crypto || !window.crypto.subtle || !window.crypto.getRandomValues) {
    enrollmentFormMessage.textContent = "Este navegador no permite crear credenciales seguras. Abre el proyecto con Live Server.";
    return;
  }

  const saltBytes = window.crypto.getRandomValues(new Uint8Array(16));
  const passwordSalt = Array.from(saltBytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  let passwordHash;
  try {
    passwordHash = await hashPassword(password, passwordSalt);
  } catch (error) {
    enrollmentFormMessage.textContent = "No se pudo crear la cuenta. Intenta abrir el proyecto con Live Server.";
    return;
  }

  const nextCode = String(129 + students.length).padStart(5, "0");
  const student = {
    code: `MAT-${nextCode}`,
    firstName,
    lastName,
    dni,
    email,
    username,
    passwordSalt,
    passwordHash,
    phone: "",
    district: "",
    career: "",
    documents: { identity: null, academic: null },
    documentsComplete: false,
    confirmed: false,
    approved: false,
    observation: "",
    status: "Pendiente del postulante",
    createdAt: new Intl.DateTimeFormat("es-PE", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    }).format(new Date())
  };
  students.push(student);
  saveStudents();
  renderAdminTables();
  newEnrollmentDialog.close();
  document.getElementById("created-account-name").textContent = `${firstName} ${lastName}`;
  document.getElementById("created-account-username").textContent = username;
  document.getElementById("created-account-password").textContent = password;
  createdAccountDialog.showModal();
  showAdminFeedback(`Se creó la matrícula de ${firstName} ${lastName}.`);
});

document.querySelectorAll(".admin-nav-link").forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    setAdminMenuOpen(false);
    if (link.dataset.action === "logout") {
      endSession();
      return;
    }
    setRoute(link.getAttribute("href"));
  });
});

document.getElementById("admin-logout").addEventListener("click", endSession);
document.querySelector(".admin-bell").addEventListener("click", () => {
  showAdminFeedback("No hay notificaciones nuevas.");
});

function renderProgressCards(student) {
  const steps = [
    { title: "Datos personales", complete: Boolean(student.phone && student.district) },
    { title: "Documentos", complete: student.documentsComplete },
    { title: "Elegir carrera", complete: Boolean(student.career) },
    { title: "Confirmación", complete: student.confirmed }
  ];
  const completed = steps.filter((step) => step.complete).length;
  const percent = completed * 25;

  document.querySelectorAll(".student-progress-card").forEach((card) => {
    card.replaceChildren();
    const heading = document.createElement("div");
    heading.className = "progress-card-heading";
    const description = document.createElement("div");
    const label = document.createElement("small");
    label.textContent = "Tu progreso de matrícula";
    const count = document.createElement("strong");
    count.textContent = `${completed} de 4 pasos completados`;
    description.append(label, count);
    const percentLabel = document.createElement("b");
    percentLabel.textContent = `${percent}%`;
    heading.append(description, percentLabel);
    const track = document.createElement("div");
    track.className = "progress-track";
    const fill = document.createElement("span");
    fill.style.width = `${percent}%`;
    track.append(fill);
    const stepList = document.createElement("div");
    stepList.className = "progress-steps";

    steps.forEach((step, index) => {
      const item = document.createElement("div");
      const isCurrent = !step.complete && steps.slice(0, index).every((previous) => previous.complete);
      item.className = `progress-step${step.complete ? " is-complete" : ""}${isCurrent ? " is-current" : ""}`;
      const mark = document.createElement("span");
      mark.className = "progress-step-mark";
      mark.textContent = step.complete ? "✓" : String(index + 1);
      const copy = document.createElement("span");
      copy.className = "progress-step-copy";
      const title = document.createElement("strong");
      title.textContent = step.title;
      const status = document.createElement("small");
      status.textContent = step.complete ? "Completado" : isCurrent ? "En proceso" : "Pendiente";
      copy.append(title, status);
      item.append(mark, copy);
      stepList.append(item);
    });
    card.append(heading, track, stepList);
  });
}

function renderCareerCards(target, student, searchTerm, filter) {
  target.replaceChildren();
  const normalizedSearch = normalizeText(searchTerm);
  const availableCareers = careers.filter((career) => {
    const matchesSearch = normalizeText(`${career.name} ${career.code}`).includes(normalizedSearch);
    const remaining = getRemainingVacancies(career, student);
    const matchesFilter = filter === "todas" ||
      (filter === "vacantes" ? remaining > 0 : career.code === filter);
    return matchesSearch && matchesFilter;
  });

  availableCareers.forEach((career) => {
    const remaining = getRemainingVacancies(career, student);
    const card = document.createElement("article");
    card.className = "student-career-card";
    const top = document.createElement("div");
    top.className = "student-career-card-top";
    const icon = document.createElement("span");
    icon.className = "student-career-icon";
    icon.textContent = career.icon;
    const vacancies = document.createElement("span");
    vacancies.className = "student-career-vacancies";
    vacancies.textContent = remaining ? `${remaining} vacantes` : "Sin vacantes";
    vacancies.classList.toggle("is-full", remaining === 0);
    top.append(icon, vacancies);
    const code = document.createElement("p");
    code.className = "student-career-code";
    code.textContent = career.code;
    const name = document.createElement("h3");
    name.textContent = career.name;
    const meta = document.createElement("div");
    meta.className = "student-career-meta";
    meta.textContent = "▣ 3 años　♙ Diurno";
    const action = document.createElement("button");
    action.type = "button";
    action.className = "student-career-action";
    const selected = student.career === career.name;
    action.textContent = selected
      ? "Vacante reservada ✓"
      : remaining
        ? "Reservar vacante　→"
        : "Sin vacantes";
    action.disabled = student.confirmed || student.approved || selected || remaining === 0;
    action.classList.toggle("is-unavailable", remaining === 0 && !selected);
    action.addEventListener("click", () => {
      if (getRemainingVacancies(career, student) === 0) {
        showStudentFeedback("Ya no quedan vacantes disponibles en esta carrera.");
        return;
      }
      student.career = career.name;
      saveStudents();
      renderStudentPortal(student);
      renderAdminTables();
      showStudentFeedback(`${career.name}: vacante reservada. Confirma la solicitud cuando completes los requisitos.`);
    });
    card.append(top, code, name, meta, action);
    target.append(card);
  });

  if (!availableCareers.length) {
    const empty = document.createElement("p");
    empty.className = "student-career-empty";
    empty.textContent = "No se encontraron carreras con esos criterios.";
    target.append(empty);
  }
}

function renderStudentPortal(student) {
  const fullName = `${student.firstName} ${student.lastName}`;
  const initials = `${student.firstName[0]}${student.lastName[0]}`.toLocaleUpperCase("es");
  document.getElementById("student-sidebar-name").textContent = fullName;
  document.getElementById("student-avatar").textContent = initials;
  document.querySelectorAll("[data-student-first-name]").forEach((element) => {
    element.textContent = student.firstName;
  });
  const studentStatus = student.approved
    ? "Matrícula aprobada"
    : student.confirmed
      ? "En revisión"
      : student.observation
        ? "Requiere correcciones"
        : "Matrícula en proceso";
  document.querySelectorAll("[data-student-status]").forEach((element) => {
    element.textContent = studentStatus;
    const badge = element.closest(".student-enrollment-status");
    badge.classList.toggle("is-approved", student.approved);
    badge.classList.toggle("is-review", student.confirmed && !student.approved);
    badge.classList.toggle("is-observed", Boolean(student.observation) && !student.confirmed);
  });
  document.getElementById("student-nav-count").hidden = student.confirmed || student.approved;
  document.querySelector(".student-sidebar-profile small").textContent =
    student.approved ? "Estudiante" : "Postulante";
  renderProgressCards(student);

  const profileForm = document.getElementById("student-profile-form");
  const isEditable = !student.confirmed && !student.approved;
  ["firstName", "lastName", "dni", "email", "phone", "district"].forEach((field) => {
    profileForm.elements[field].value = student[field] || "";
  });
  ["email", "phone", "district"].forEach((field) => {
    profileForm.elements[field].disabled = !isEditable;
  });
  const documents = student.documents || { identity: null, academic: null };
  document.getElementById("student-identity-file-name").textContent =
    documents.identity ? documents.identity.name : "Aún no adjuntado";
  document.getElementById("student-academic-file-name").textContent =
    documents.academic ? documents.academic.name : "Aún no adjuntado";
  document.getElementById("student-identity-file").disabled = !isEditable;
  document.getElementById("student-academic-file").disabled = !isEditable;
  const documentsCheckbox = document.getElementById("student-documents-check");
  const hasRequiredDocuments = Boolean(documents.identity && documents.academic);
  documentsCheckbox.checked = student.documentsComplete;
  documentsCheckbox.disabled = !hasRequiredDocuments || !isEditable;
  const observation = document.getElementById("student-observation");
  observation.hidden = !student.observation || student.approved;
  document.getElementById("student-observation-text").textContent = student.observation;
  document.getElementById("student-application-career").textContent =
    student.career || "Aún no elegiste una carrera";
  document.getElementById("student-application-code").textContent = student.code;
  document.getElementById("student-ticket").hidden = !student.approved;
  if (student.approved) {
    document.getElementById("ticket-student-name").textContent = fullName;
    document.getElementById("ticket-student-dni").textContent = student.dni;
    document.getElementById("ticket-enrollment-code").textContent = student.code;
    document.getElementById("ticket-career").textContent = student.career || "No registrado";
    document.getElementById("ticket-approval-date").textContent = new Intl.DateTimeFormat("es-PE", {
      day: "2-digit",
      month: "long",
      year: "numeric"
    }).format(new Date(student.approvedAt || student.createdAt));
  }
  const applicationStatus = document.getElementById("student-application-status");
  applicationStatus.textContent = student.approved
    ? "Aprobada"
    : student.confirmed
      ? "En revisión"
      : student.observation
        ? "Observada"
        : "En proceso";
  applicationStatus.className = `admin-status ${
    student.approved
      ? "status-approved"
      : student.confirmed
        ? "status-review"
        : student.observation
          ? "status-observed"
          : "status-pending"
  }`;

  const confirmButton = document.getElementById("student-confirm-enrollment");
  confirmButton.disabled =
    !student.career || !student.documentsComplete || student.confirmed || student.approved;
  confirmButton.textContent = student.approved
    ? "Matrícula aprobada"
    : student.confirmed
      ? "Solicitud en revisión"
      : student.observation
        ? "Reenviar solicitud"
        : "Enviar solicitud";
  renderNextSteps(student);
  renderCareerCards(
    document.getElementById("student-career-grid"),
    student,
    document.getElementById("student-career-search").value,
    careerFilter
  );
  renderCareerCards(
    document.getElementById("student-career-grid-secondary"),
    student,
    document.querySelector(".student-career-search-secondary").value,
    "todas"
  );
}

function renderNextSteps(student) {
  const list = document.getElementById("student-next-steps");
  list.replaceChildren();
  const nextSteps = [
    {
      title: "Datos personales",
      detail: student.phone && student.district
        ? "Información de contacto completa"
        : "Completa tu perfil en Mi perfil",
      complete: Boolean(student.phone && student.district)
    },
    {
      title: "Documentos",
      detail: student.documentsComplete
        ? "Archivos adjuntos y declarados"
        : "Adjunta los dos documentos en Mi matrícula",
      complete: student.documentsComplete
    },
    { title: "Elegir carrera", detail: student.career || "Selecciona una carrera disponible", complete: Boolean(student.career) },
    {
      title: "Confirmación de matrícula",
      detail: student.approved
        ? "Matrícula aprobada"
        : student.confirmed
          ? "Solicitud enviada para revisión"
          : student.observation
            ? "Corrige y reenvía la solicitud"
            : "Envía la solicitud cuando completes los pasos",
      complete: student.confirmed
    }
  ];
  nextSteps.forEach((step, index) => {
    const item = document.createElement("li");
    const mark = document.createElement("span");
    mark.className = `next-step-mark${step.complete ? " is-complete" : ""}`;
    mark.textContent = step.complete ? "✓" : String(index + 1);
    const copy = document.createElement("span");
    const title = document.createElement("strong");
    title.textContent = step.title;
    const detail = document.createElement("small");
    detail.textContent = step.detail;
    copy.append(title, detail);
    item.append(mark, copy);
    list.append(item);
  });
}

function showStudentFeedback(message) {
  const feedback = document.getElementById("student-feedback");
  feedback.textContent = message;
  feedback.classList.add("is-visible");
  window.clearTimeout(feedbackTimeout);
  feedbackTimeout = window.setTimeout(() => feedback.classList.remove("is-visible"), 3000);
}

document.querySelectorAll(".student-nav-link").forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    setStudentMenuOpen(false);
    if (link.dataset.action === "logout") {
      endSession();
      return;
    }
    setRoute(link.getAttribute("href"));
  });
});

document.getElementById("student-logout").addEventListener("click", endSession);

document.getElementById("student-career-search").addEventListener("input", () => {
  const session = getSession();
  const student = session && students.find((account) => account.username === session.username);
  if (student) renderStudentPortal(student);
});

document.querySelectorAll(".student-career-search-secondary").forEach((input) => {
  input.addEventListener("input", () => {
    const session = getSession();
    const student = session && students.find((account) => account.username === session.username);
    if (student) renderStudentPortal(student);
  });
});

document.querySelectorAll("[data-career-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    careerFilter = button.dataset.careerFilter;
    document.querySelectorAll("[data-career-filter]").forEach((filterButton) => {
      filterButton.classList.toggle("is-selected", filterButton === button);
    });
    const session = getSession();
    const student = session && students.find((account) => account.username === session.username);
    if (student) renderStudentPortal(student);
  });
});

async function handleStudentDocumentUpload(event, documentKey) {
  const input = event.currentTarget;
  const file = input.files[0];
  if (!file) return;
  const message = document.getElementById("student-document-message");
  const session = getSession();
  const student = session && students.find((account) => account.username === session.username);
  if (!student || student.confirmed || student.approved) return;

  if (!/\.(pdf|jpe?g|png)$/i.test(file.name)) {
    message.textContent = "Adjunta un archivo PDF, JPG o PNG.";
    input.value = "";
    return;
  }
  if (file.size > MAX_DOCUMENT_SIZE) {
    message.textContent = "Cada archivo debe pesar como máximo 5 MB.";
    input.value = "";
    return;
  }

  message.textContent = "Guardando documento en este navegador...";
  try {
    await saveStudentDocument(student.username, documentKey, file);
    if (!student.documents) student.documents = { identity: null, academic: null };
    student.documents[documentKey] = {
      name: file.name,
      size: file.size,
      type: file.type
    };
    student.documentsComplete = false;
    saveStudents();
    renderStudentPortal(student);
    renderAdminTables();
    message.textContent = `${file.name} quedó adjuntado.`;
  } catch (error) {
    message.textContent = `No se pudo guardar el archivo: ${error.message}`;
  }
  input.value = "";
}

document.getElementById("student-identity-file").addEventListener("change", (event) => {
  handleStudentDocumentUpload(event, "identity");
});
document.getElementById("student-academic-file").addEventListener("change", (event) => {
  handleStudentDocumentUpload(event, "academic");
});

document.getElementById("student-documents-check").addEventListener("change", (event) => {
  const session = getSession();
  const student = session && students.find((account) => account.username === session.username);
  if (!student) return;
  const documents = student.documents || {};
  const hasRequiredDocuments = Boolean(documents.identity && documents.academic);
  if (event.target.checked && !hasRequiredDocuments) {
    event.target.checked = false;
    document.getElementById("student-document-message").textContent =
      "Adjunta los dos documentos requeridos antes de continuar.";
    return;
  }
  student.documentsComplete = event.target.checked && hasRequiredDocuments;
  saveStudents();
  renderStudentPortal(student);
});

document.getElementById("student-profile-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const session = getSession();
  const student = session && students.find((account) => account.username === session.username);
  if (!student) return;
  const values = new FormData(event.currentTarget);
  student.email = String(values.get("email")).trim();
  student.phone = String(values.get("phone")).trim();
  student.district = String(values.get("district")).trim();
  saveStudents();
  document.getElementById("student-profile-message").textContent =
    "Tus datos se actualizaron en este navegador.";
  document.getElementById("student-confirm-message").textContent = "";
  renderAdminTables();
});

document.getElementById("student-confirm-enrollment").addEventListener("click", () => {
  const session = getSession();
  const student = session && students.find((account) => account.username === session.username);
  if (!student) return;
  if (!student.phone || !student.district) {
    document.getElementById("student-confirm-message").textContent =
      "Completa tu teléfono y distrito en “Mi perfil” antes de enviar.";
    return;
  }
  if (!student.documentsComplete) {
    document.getElementById("student-confirm-message").textContent =
      "Adjunta y confirma los documentos requeridos antes de enviar.";
    return;
  }
  if (!student.career) {
    document.getElementById("student-confirm-message").textContent =
      "Elige una carrera para continuar con la matrícula.";
    return;
  }
  if (student.approved || student.confirmed) return;
  student.confirmed = true;
  student.observation = "";
  student.status = "En revisión";
  saveStudents();
  renderStudentPortal(student);
  renderAdminTables();
  document.getElementById("student-confirm-career").textContent = student.career;
  studentConfirmDialog.showModal();
});

document.getElementById("student-confirm-dialog-button").addEventListener("click", () => {
  studentConfirmDialog.close();
  setRoute("#estudiante-matricula");
});

document.getElementById("student-ticket-print").addEventListener("click", () => {
  const session = getSession();
  const student = session && students.find((account) => account.username === session.username);
  if (!student || !student.approved) {
    showStudentFeedback("El boleto estará disponible cuando administración apruebe tu matrícula.");
    return;
  }
  window.print();
});

window.addEventListener("storage", (event) => {
  if (event.key !== STUDENTS_STORAGE_KEY) return;
  const previousSession = getSession();
  const previousStudent = previousSession && previousSession.role === "student"
    ? students.find((student) => student.username === previousSession.username)
    : null;
  students = event.newValue ? JSON.parse(event.newValue) : [];
  students.forEach((student) => {
    if (!student.documents) student.documents = { identity: null, academic: null };
    if (!student.documents.identity || !student.documents.academic) {
      student.documentsComplete = false;
    }
    if (typeof student.observation !== "string") student.observation = "";
  });
  renderAdminTables();
  if (!previousSession || previousSession.role !== "student") return;
  const student = students.find((account) => account.username === previousSession.username);
  if (!student) {
    endSession();
    return;
  }
  renderStudentPortal(student);
  if (student.approved && (!previousStudent || !previousStudent.approved)) {
    showStudentFeedback("Administración aprobó tu matrícula. Ya puedes imprimir o guardar tu boleto.");
  }
});

window.addEventListener("hashchange", updatePageView);
updatePageView();
