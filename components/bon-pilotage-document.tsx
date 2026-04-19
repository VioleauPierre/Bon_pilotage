import { COMPANY_INFO, LIABILITY_NOTICE, MAX_ITINERARY_ROWS } from "@/lib/constants";
import {
  fillDisplayRows,
  formatDateLabel,
  formatTimeLabel,
  getDraftTotalKm,
} from "@/lib/format";
import type { BonPilotageDisplayData } from "@/lib/types";

type BonPilotageDocumentProps = {
  data: BonPilotageDisplayData;
};

const styles = {
  page: {
    width: "794px",
    margin: "0 auto",
    padding: "20px",
    backgroundColor: "#ffffff",
    color: "#111827",
    fontFamily: "Arial, Helvetica, sans-serif",
    border: "2px solid #111827",
    boxSizing: "border-box" as const,
  },
  topPilot: {
    display: "flex",
    justifyContent: "flex-end",
    marginBottom: "12px",
    fontSize: "12px",
  },
  topPilotValue: {
    display: "inline-block",
    minWidth: "220px",
    marginLeft: "8px",
    paddingBottom: "2px",
    borderBottom: "1px solid #111827",
    fontWeight: 700,
  },
  topGrid: {
    display: "grid",
    gridTemplateColumns: "1.08fr 0.92fr",
    gap: "12px",
    marginBottom: "12px",
  },
  card: {
    border: "2px solid #111827",
    minHeight: "120px",
  },
  companyCard: {
    padding: "10px 12px",
  },
  companyName: {
    margin: "0 0 8px",
    fontSize: "25px",
    fontWeight: 800,
    letterSpacing: "0.04em",
  },
  companyLine: {
    margin: "0",
    fontSize: "13px",
    lineHeight: 1.45,
  },
  titleCard: {
    display: "grid",
    gridTemplateRows: "1fr auto",
  },
  titleBar: {
    display: "grid",
    placeItems: "center",
    minHeight: "74px",
    padding: "10px",
    borderBottom: "2px solid #111827",
    fontWeight: 800,
    fontSize: "22px",
    letterSpacing: "0.04em",
    textAlign: "center" as const,
    textTransform: "uppercase" as const,
  },
  bonNumber: {
    display: "grid",
    placeItems: "center",
    minHeight: "44px",
    fontSize: "18px",
    fontWeight: 800,
  },
  rows: {
    display: "grid",
    gap: "0",
  },
  infoRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
  },
  cell: {
    border: "1px solid #111827",
    padding: "8px 10px",
    minHeight: "48px",
  },
  sectionHeader: {
    display: "grid",
    placeItems: "center",
    backgroundColor: "#111827",
    color: "#ffffff",
    fontWeight: 800,
    letterSpacing: "0.06em",
    textTransform: "uppercase" as const,
  },
  label: {
    display: "block",
    marginBottom: "4px",
    fontSize: "11px",
    fontWeight: 700,
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
  },
  value: {
    fontSize: "14px",
    fontWeight: 700,
    lineHeight: 1.4,
  },
  smallValue: {
    fontSize: "13px",
    fontWeight: 700,
    lineHeight: 1.35,
  },
  signatureValue: {
    fontSize: "17px",
    fontStyle: "italic",
    fontWeight: 700,
    lineHeight: 1.4,
  },
  noteBox: {
    fontSize: "11px",
    lineHeight: 1.45,
    textAlign: "justify" as const,
  },
  itineraryTable: {
    width: "100%",
    borderCollapse: "collapse" as const,
    marginTop: "12px",
  },
  itineraryHeadCell: {
    border: "1px solid #111827",
    padding: "8px 6px",
    backgroundColor: "#f1f5f9",
    fontSize: "11px",
    fontWeight: 800,
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
    textAlign: "center" as const,
  },
  itineraryCell: {
    border: "1px solid #111827",
    padding: "7px 6px",
    fontSize: "12px",
    minHeight: "34px",
    height: "34px",
  },
  observations: {
    border: "2px solid #111827",
    minHeight: "108px",
    marginTop: "12px",
    padding: "10px 12px",
  },
  observationsLabel: {
    margin: "0 0 8px",
    fontSize: "11px",
    fontWeight: 800,
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
  },
  observationsText: {
    margin: 0,
    minHeight: "70px",
    whiteSpace: "pre-wrap" as const,
    fontSize: "13px",
    lineHeight: 1.5,
  },
  footer: {
    marginTop: "10px",
    textAlign: "right" as const,
    fontSize: "10px",
    color: "#475467",
  },
};

function DisplayValue({
  value,
  placeholder = " ",
  small = false,
  signature = false,
}: {
  value?: string | number;
  placeholder?: string;
  small?: boolean;
  signature?: boolean;
}) {
  const displayValue =
    typeof value === "number" ? `${value}` : (value?.trim() ?? "") || placeholder;

  return (
    <span
      style={
        signature
          ? styles.signatureValue
          : small
            ? styles.smallValue
            : styles.value
      }
    >
      {displayValue}
    </span>
  );
}

export function BonPilotageDocument({ data }: BonPilotageDocumentProps) {
  const itineraryRows = fillDisplayRows(
    data.itinerary.slice(0, MAX_ITINERARY_ROWS),
    () => ({
      date: "",
      departureCity: "",
      departureTime: "",
      arrivalCity: "",
      arrivalTime: "",
      km: "",
    }),
  );
  const totalKm =
    typeof data.totalKm === "number" || typeof data.totalKm === "string"
      ? data.totalKm
      : getDraftTotalKm(data.itinerary);

  return (
    <div style={styles.page}>
      <div style={styles.topPilot}>
        <span>Nom du pilote :</span>
        <span style={styles.topPilotValue}>{data.pilotName || " "}</span>
      </div>

      <div style={styles.topGrid}>
        <div style={{ ...styles.card, ...styles.companyCard }}>
          <p style={styles.companyName}>{COMPANY_INFO.name}</p>
          <p style={styles.companyLine}>{COMPANY_INFO.addressLine1}</p>
          <p style={styles.companyLine}>{COMPANY_INFO.addressLine2}</p>
          <p style={{ ...styles.companyLine, marginTop: "8px" }}>
            Email : {COMPANY_INFO.email}
          </p>
          <p style={styles.companyLine}>Tél. {COMPANY_INFO.phone}</p>
        </div>

        <div style={{ ...styles.card, ...styles.titleCard }}>
          <div style={styles.titleBar}>Bon de pilotage</div>
          <div style={styles.bonNumber}>
            N° <DisplayValue value={data.bonNumber} placeholder="-" />
          </div>
        </div>
      </div>

      <div style={styles.rows}>
        <div style={styles.infoRow}>
          <div style={styles.cell}>
            <span style={styles.label}>Transporteur</span>
            <DisplayValue value={data.transporter} />
          </div>
          <div style={styles.cell}>
            <span style={styles.label}>Immatriculation TR/SR</span>
            <DisplayValue value={data.vehicleRegistration} />
          </div>
        </div>

        <div style={styles.infoRow}>
          <div style={{ ...styles.cell, ...styles.sectionHeader }}>Prestation</div>
          <div style={styles.cell}>
            <span style={styles.label}>Catégorie du convoi</span>
            <DisplayValue value={data.convoyCategory} />
          </div>
        </div>

        <div style={styles.infoRow}>
          <div style={styles.cell}>
            <span style={styles.label}>N° arrêté</span>
            <DisplayValue value={data.decreeNumber || "néant"} />
          </div>
          <div style={styles.cell}>
            <span style={styles.label}>Nom du chauffeur</span>
            <DisplayValue value={data.driverName} />
          </div>
        </div>

        <div style={styles.infoRow}>
          <div style={styles.cell}>
            <span style={styles.label}>Date et heure de prise en charge demandées</span>
            <DisplayValue
              value={`Le ${formatDateLabel(data.pickupDate)} à ${formatTimeLabel(data.pickupTime)}`}
              small
            />
          </div>
          <div style={styles.cell}>
            <span style={styles.label}>Signature</span>
            <DisplayValue value={data.driverSignature} signature />
          </div>
        </div>

        <div style={styles.infoRow}>
          <div style={styles.cell}>
            <span style={styles.label}>Ville de départ</span>
            <DisplayValue value={data.departureCity} />
          </div>
          <div style={styles.cell}>
            <span style={styles.label}>Ville d&apos;arrivée</span>
            <DisplayValue value={data.arrivalCity} />
          </div>
        </div>

        <div style={styles.infoRow}>
          <div style={styles.cell}>
            <span style={styles.label}>Total km</span>
            <DisplayValue value={`${totalKm || 0} km`} />
          </div>
          <div style={{ ...styles.cell, ...styles.noteBox }}>{LIABILITY_NOTICE}</div>
        </div>
      </div>

      <table style={styles.itineraryTable}>
        <thead>
          <tr>
            <th style={{ ...styles.itineraryHeadCell, width: "14%" }}>Date</th>
            <th style={{ ...styles.itineraryHeadCell, width: "24%" }}>
              Ville départ (département)
            </th>
            <th style={{ ...styles.itineraryHeadCell, width: "10%" }}>H</th>
            <th style={{ ...styles.itineraryHeadCell, width: "24%" }}>
              Ville d&apos;arrivée (département)
            </th>
            <th style={{ ...styles.itineraryHeadCell, width: "10%" }}>H</th>
            <th style={{ ...styles.itineraryHeadCell, width: "18%" }}>km</th>
          </tr>
        </thead>
        <tbody>
          {itineraryRows.map((row, index) => (
            <tr key={`${row.date}-${row.departureCity}-${index}`}>
              <td style={styles.itineraryCell}>{formatDateLabel(row.date)}</td>
              <td style={styles.itineraryCell}>{row.departureCity}</td>
              <td style={{ ...styles.itineraryCell, textAlign: "center" }}>
                {formatTimeLabel(row.departureTime)}
              </td>
              <td style={styles.itineraryCell}>{row.arrivalCity}</td>
              <td style={{ ...styles.itineraryCell, textAlign: "center" }}>
                {formatTimeLabel(row.arrivalTime)}
              </td>
              <td style={{ ...styles.itineraryCell, textAlign: "right" }}>
                {row.km ? `${row.km}` : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={styles.observations}>
        <p style={styles.observationsLabel}>Observations</p>
        <p style={styles.observationsText}>{data.observations || " "}</p>
      </div>

      <div style={styles.footer}>
        Document généré le {data.generatedAt || new Date().toLocaleString("fr-FR")}
      </div>
    </div>
  );
}
