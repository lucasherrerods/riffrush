import * as THREE from "three";
import { criarAjustador } from "./ajustes";

const angulo = (no: THREE.Object3D) => no.quaternion.angleTo(new THREE.Quaternion());

describe("criarAjustador", () => {
  // Bug: o mixer só reescreve a pose quando ela muda; com a pose parada, os ajustes somavam a cada quadro e a cabeça girava sem parar.
  it("não acumula o ajuste entre quadros quando ninguém reescreve a pose", () => {
    const cabeca = new THREE.Object3D();
    const ajustador = criarAjustador();
    for (let quadro = 0; quadro < 100; quadro++) {
      ajustador.desfazer();
      ajustador.aplicar(cabeca, [0, 0.1, 0]);
    }
    expect(angulo(cabeca)).toBeCloseTo(0.1);
  });

  it("aplica por cima da pose nova quando a animação reescreve o osso", () => {
    const cabeca = new THREE.Object3D();
    const ajustador = criarAjustador();
    ajustador.aplicar(cabeca, [0, 0.1, 0]);
    ajustador.desfazer();
    const daAnimacao = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.5);
    cabeca.quaternion.copy(daAnimacao);
    ajustador.aplicar(cabeca, [0, 0, 0]);
    expect(cabeca.quaternion.angleTo(daAnimacao)).toBeCloseTo(0);
  });

  it("desfazer volta o osso para a pose de antes do ajuste", () => {
    const peito = new THREE.Object3D();
    const ajustador = criarAjustador();
    ajustador.aplicar(peito, [0.3, 0, 0]);
    ajustador.desfazer();
    expect(angulo(peito)).toBeCloseTo(0);
  });
});
