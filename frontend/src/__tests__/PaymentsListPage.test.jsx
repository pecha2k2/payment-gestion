import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { api } from "../api";
import PaymentsListPage from "../pages/PaymentsListPage";

vi.mock("../api", () => ({
  api: {
    getPayments: vi.fn(),
    search: vi.fn(),
  },
}));

describe("PaymentsListPage", () => {
  beforeEach(() => {
    api.getPayments.mockResolvedValue({
      items: [
        {
          id: 1,
          numero_peticion: "PAY-2026-0001",
          propuesta_gasto: 12345,
          orden_pago: null,
          tipo_pago: "CON_FACTURA",
          estado_general: "ABIERTA",
          monto_total: 100,
          divisa: "EUR",
        },
      ],
      total: 1,
      page: 1,
      per_page: 20,
      pages: 1,
    });
  });

  it("does not label a nonterminal payment as completed when workflow state is unavailable", async () => {
    render(
      <MemoryRouter>
        <PaymentsListPage user={{ role: "demandante" }} />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Estado no disponible")).toBeInTheDocument();
    expect(screen.queryByText("Completado")).not.toBeInTheDocument();
  });
});
