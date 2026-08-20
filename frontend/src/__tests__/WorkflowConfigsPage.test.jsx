import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { api } from "../api";
import WorkflowConfigsPage from "../pages/WorkflowConfigsPage";

vi.mock("../api", () => ({
  api: {
    getWorkflowConfigs: vi.fn(),
  },
}));

describe("WorkflowConfigsPage", () => {
  beforeEach(() => {
    api.getWorkflowConfigs.mockResolvedValue([
      {
        id: 1,
        nombre: "Flujo dañado",
        descripcion: "",
        tipo_pago: "CON_FACTURA",
        es_default: false,
        flujo_json: '["demandante", invalid]',
        activo: true,
      },
    ]);
  });

  it("renders a valid persisted workflow preview", async () => {
    api.getWorkflowConfigs.mockResolvedValueOnce([
      {
        id: 2,
        nombre: "Flujo válido",
        descripcion: "",
        tipo_pago: "CON_FACTURA",
        es_default: true,
        flujo_json: '["demandante", "validadora"]',
        activo: true,
      },
    ]);

    render(<WorkflowConfigsPage />);

    const configName = await screen.findByText("Flujo válido");
    const row = configName.closest("tr");

    expect(within(row).getByText(/demandante/)).toBeInTheDocument();
    expect(within(row).getByText(/validadora/)).toBeInTheDocument();
    expect(within(row).queryByText("Formato inválido")).not.toBeInTheDocument();
  });

  it("opens malformed persisted workflow JSON for safe correction", async () => {
    render(<WorkflowConfigsPage />);

    await screen.findByText("Flujo dañado");
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));

    expect(
      screen.getByRole("heading", { name: "Editar Flujo" }),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/demandante/)).toHaveValue(
      '["demandante", invalid]',
    );
    expect(screen.getByText(/contiene JSON inválido/)).toBeInTheDocument();
  });
});
