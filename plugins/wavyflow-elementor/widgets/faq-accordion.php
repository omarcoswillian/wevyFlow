<?php
namespace WavyFlow\Widgets;
use Elementor\Widget_Base;
use Elementor\Controls_Manager;
use Elementor\Repeater;

if (!defined('ABSPATH')) exit;

class FAQ_Accordion extends Widget_Base {
    public function get_name() { return 'wf-faq-accordion'; }
    public function get_title() { return 'WavyFlow FAQ Accordion'; }
    public function get_icon() { return 'eicon-accordion'; }
    public function get_categories() { return ['wavyflow']; }

    protected function register_controls() {
        $this->start_controls_section('header_section', ['label' => 'Cabecalho']);
        $this->add_control('heading', ['label' => 'Titulo', 'type' => Controls_Manager::TEXT, 'default' => 'Perguntas frequentes']);
        $this->add_control('subtitle', ['label' => 'Subtitulo', 'type' => Controls_Manager::TEXT, 'default' => 'Tire suas duvidas antes de se inscrever.']);
        $this->add_control('dark_mode', ['label' => 'Modo escuro', 'type' => Controls_Manager::SWITCHER, 'default' => 'yes']);
        $this->end_controls_section();

        $this->start_controls_section('faq_section', ['label' => 'Perguntas']);
        $repeater = new Repeater();
        $repeater->add_control('question', ['label' => 'Pergunta', 'type' => Controls_Manager::TEXT]);
        $repeater->add_control('answer', ['label' => 'Resposta', 'type' => Controls_Manager::TEXTAREA]);
        $this->add_control('faqs', [
            'label' => 'FAQs',
            'type' => Controls_Manager::REPEATER,
            'fields' => $repeater->get_controls(),
            'default' => [
                ['question' => 'Preciso ler muitos livros por mes?', 'answer' => 'Nao. O metodo funciona mesmo que voce leia apenas 1 livro por mes.'],
                ['question' => 'Em quanto tempo vejo resultados?', 'answer' => 'Nossos alunos mais aplicados comecam a ver resultados nas primeiras 2-4 semanas.'],
                ['question' => 'Funciona para qualquer nicho?', 'answer' => 'Sim. O metodo e adaptavel para qualquer area de conhecimento.'],
                ['question' => 'Tem garantia?', 'answer' => 'Sim, garantia incondicional de 7 dias.'],
                ['question' => 'Como funciona o acesso?', 'answer' => 'Apos a compra, voce recebe acesso imediato a plataforma.'],
            ],
            'title_field' => '{{{ question }}}',
        ]);
        $this->end_controls_section();
    }

    protected function render() {
        $s = $this->get_settings_for_display();
        $dark = ($s['dark_mode'] ?? '') === 'yes';
        ?>
        <div class="wf-block<?php echo $dark ? ' wf-block--dark' : ''; ?>">
            <div class="wf-content">
                <div class="wf-wrap">
                    <div class="wf-faq-grid">
                        <div class="wf-faq-head wf-rv">
                            <div class="wf-label">FAQ</div>
                            <h2 class="wf-h2"><?php echo esc_html($s['heading']); ?></h2>
                            <p><?php echo esc_html($s['subtitle']); ?></p>
                        </div>
                        <div class="wf-faq-list wf-rv">
                            <?php foreach ($s['faqs'] as $faq): ?>
                            <div class="wf-faq-item">
                                <button class="wf-faq-q">
                                    <?php echo esc_html($faq['question']); ?>
                                    <span class="wf-faq-toggle"></span>
                                </button>
                                <div class="wf-faq-a">
                                    <div class="wf-faq-a-inner"><?php echo esc_html($faq['answer']); ?></div>
                                </div>
                            </div>
                            <?php endforeach; ?>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <?php
    }
}
